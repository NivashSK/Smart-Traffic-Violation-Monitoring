from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import List
from datetime import datetime
import os
import shutil
import time
import asyncio
import io
import cv2
from app.core.config import UPLOADS_DIR, SAMPLES_DIR, VEHICLE_REGISTRY, TRAFFIC_VIDEOS_DIR
from app.core.video_processor import TrafficVideoProcessor, ACTIVE_TASKS, VIOLATIONS_DATABASE, ACTIVE_PROCESSORS
from app.api.schemas import TrafficConfig, ViolationRecord, ProcessorStatus, AnalyticsSummary

router = APIRouter()

@router.post("/traffic/upload")
async def upload_video(file: UploadFile = File(...)):
    """
    Handles traffic video uploads and stores them locally for processing.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".mp4", ".avi", ".mov", ".mkv"]:
        raise HTTPException(status_code=400, detail="Invalid video file format. Supported: MP4, AVI, MOV, MKV.")
    
    file_path = os.path.join(UPLOADS_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {
        "filename": file.filename,
        "video_path": f"/data/uploads/{file.filename}",
        "status": "uploaded"
    }

@router.post("/traffic/process")
async def process_video(
    background_tasks: BackgroundTasks,
    video_name: str,
    config: TrafficConfig
):
    """
    Spawns an asynchronous background worker task to process the traffic video
    and run violation reasoning.
    """
    # Look for video in uploads first, then samples, then traffic_videos
    video_path = os.path.join(UPLOADS_DIR, video_name)
    if not os.path.exists(video_path):
        video_path = os.path.join(SAMPLES_DIR, video_name)
        if not os.path.exists(video_path):
            video_path = os.path.join(TRAFFIC_VIDEOS_DIR, video_name)
            if not os.path.exists(video_path):
                raise HTTPException(status_code=404, detail=f"Video file '{video_name}' not found.")
            
    task_id = f"task_{int(time.time())}"
    
    # Initialize background processor
    processor = TrafficVideoProcessor(task_id)
    ACTIVE_TASKS[task_id] = processor.get_status()
    
    background_tasks.add_task(processor.process, video_path, config.model_dump())
    
    return {
        "task_id": task_id,
        "status": "started",
        "message": f"Analysis started for {video_name}"
    }

@router.get("/traffic/status/{task_id}", response_model=ProcessorStatus)
def get_task_status(task_id: str):
    """
    Polls the current execution status and progress of a video analysis task.
    """
    if task_id in ACTIVE_PROCESSORS:
        return ACTIVE_PROCESSORS[task_id].get_status()
    if task_id not in ACTIVE_TASKS:
        raise HTTPException(status_code=404, detail="Task not found.")
    return ACTIVE_TASKS[task_id]

@router.get("/traffic/stream/{task_id}")
async def stream_task_frames(task_id: str):
    """
    Streams the latest processed/annotated frame of the video analysis task in real time (MJPEG format).
    """
    if task_id not in ACTIVE_PROCESSORS:
        raise HTTPException(status_code=404, detail="Active task stream not found.")
        
    processor = ACTIVE_PROCESSORS[task_id]
    
    async def frame_generator():
        last_frame_idx = -1
        while processor.status == "processing":
            if getattr(processor, "latest_frame", None) is not None:
                if processor.current_frame != last_frame_idx:
                    last_frame_idx = processor.current_frame
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + processor.latest_frame + b'\r\n')
            await asyncio.sleep(0.04) # ~25 FPS polling limit
            
        # Stream the last frame once task finishes so the user sees the final frame
        if getattr(processor, "latest_frame", None) is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + processor.latest_frame + b'\r\n')
            
    return StreamingResponse(frame_generator(), media_type="multipart/x-mixed-replace; boundary=frame")

@router.get("/traffic/preview")
def get_video_preview(video_name: str):
    """
    Extracts and returns the first frame of the selected video as a JPEG image.
    """
    video_path = os.path.join(UPLOADS_DIR, video_name)
    if not os.path.exists(video_path):
        video_path = os.path.join(SAMPLES_DIR, video_name)
        if not os.path.exists(video_path):
            video_path = os.path.join(TRAFFIC_VIDEOS_DIR, video_name)
            if not os.path.exists(video_path):
                raise HTTPException(status_code=404, detail=f"Video file '{video_name}' not found.")
                
    cap = cv2.VideoCapture(video_path)
    ret, frame = cap.read()
    cap.release()
    
    if not ret or frame is None:
        raise HTTPException(status_code=500, detail="Failed to read video frame preview.")
        
    _, jpeg_buf = cv2.imencode('.jpg', frame)
    return StreamingResponse(io.BytesIO(jpeg_buf.tobytes()), media_type="image/jpeg")

@router.post("/traffic/terminate/{task_id}")
def terminate_task(task_id: str):
    """
    Safely terminates an active video processing task.
    """
    if task_id in ACTIVE_PROCESSORS:
        processor = ACTIVE_PROCESSORS[task_id]
        processor.cancelled = True
        processor.status = "terminated"
        ACTIVE_TASKS[task_id] = processor.get_status()
        return {"status": "terminated", "task_id": task_id, "message": "Termination signal sent successfully."}
    
    if task_id in ACTIVE_TASKS:
        ACTIVE_TASKS[task_id]["status"] = "terminated"
        return {"status": "terminated", "task_id": task_id, "message": "Task marked as terminated."}
        
    raise HTTPException(status_code=404, detail="Task not found.")

@router.get("/traffic/violations", response_model=List[ViolationRecord])
def get_violations():
    """
    Returns the cumulative logged traffic violations database.
    """
    return VIOLATIONS_DATABASE

@router.get("/traffic/analytics", response_model=AnalyticsSummary)
def get_analytics():
    """
    Aggregates in-memory violation details into high-level analytical metrics
    for dashboard visualization.
    """
    total = len(VIOLATIONS_DATABASE)
    
    by_type = {
        "Red Light Jumping": 0,
        "Stop Line Violation": 0,
        "Overspeeding": 0,
        "No Helmet": 0,
        "Illegal Parking": 0
    }
    
    v_classes = {}
    compliance = {
        "insurance_expired": 0,
        "puc_expired": 0,
        "rc_suspended": 0,
        "fully_compliant": 0
    }
    
    time_series = {}
    
    for v in VIOLATIONS_DATABASE:
        # Extract fields safely supporting both dict and Pydantic model
        v_dict = v if isinstance(v, dict) else (v.model_dump() if hasattr(v, "model_dump") else v.__dict__)
        
        # 1. Group by violation category
        t_type = v_dict.get("violation_type")
        if t_type in by_type:
            by_type[t_type] += 1
            
        # 2. Group by vehicle type
        v_class = v_dict.get("vehicle_class")
        if v_class:
            v_classes[v_class] = v_classes.get(v_class, 0) + 1
        
        # 3. Aggregrated registration status counts
        has_issue = False
        ins_status = v_dict.get("insurance_status")
        puc_status = v_dict.get("puc_status")
        rc_status = v_dict.get("rc_status")
        
        if ins_status == "EXPIRED":
            compliance["insurance_expired"] += 1
            has_issue = True
        if puc_status == "EXPIRED":
            compliance["puc_expired"] += 1
            has_issue = True
        if rc_status == "SUSPENDED":
            compliance["rc_suspended"] += 1
            has_issue = True
            
        if not has_issue and rc_status != "UNAVAILABLE":
            compliance["fully_compliant"] += 1
            
        # 4. Temporal analysis
        time_str = v_dict.get("time", "")
        if time_str:
            v_time = time_str[:5]  # Format: "HH:MM"
            time_series[v_time] = time_series.get(v_time, 0) + 1
        
    # Format sorted time points for frontend Recharts LineChart
    sorted_time = [{"time": k, "count": v} for k, v in sorted(time_series.items())]
    if not sorted_time:
        sorted_time = [{"time": datetime.now().strftime("%H:%M"), "count": 0}]
        
    return AnalyticsSummary(
        violations_by_type=by_type,
        violations_over_time=sorted_time,
        vehicle_types=v_classes,
        total_violations=total,
        compliance_summary=compliance
    )

@router.get("/traffic/sample")
def get_sample_videos():
    """
    Retrieves lists of available demo footage and test videos.
    """
    samples = []
    if os.path.exists(os.path.join(SAMPLES_DIR, "sample_traffic.mp4")):
        samples.append({"name": "sample_traffic.mp4", "size": "Demonstration Video (MP4)"})
        
    # Scan real-world traffic videos
    if os.path.exists(TRAFFIC_VIDEOS_DIR):
        for f in os.listdir(TRAFFIC_VIDEOS_DIR):
            if f.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
                samples.append({"name": f, "size": "AI City Challenge Video"})
    return samples

@router.get("/traffic/registry")
def get_demonstration_registry():
    """
    Exposes the read-only demonstration registry details.
    """
    return VEHICLE_REGISTRY

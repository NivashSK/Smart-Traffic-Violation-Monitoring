from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class TrafficConfig(BaseModel):
    stop_line_y: int = Field(350, ge=100, le=1000, description="Y-coordinate of the virtual stop line")
    speed_limit: float = Field(50.0, ge=10.0, le=150.0, description="Speed limit in km/h")
    parking_limit: float = Field(15.0, ge=5.0, le=300.0, description="Max allowed stationary duration in seconds")
    
    # Custom calibration properties
    stop_line: Optional[List[List[int]]] = None
    road_polygon: Optional[List[List[int]]] = None
    no_parking_polygon: Optional[List[List[int]]] = None
    speed_polygon: Optional[List[List[int]]] = None
    homography_src_points: Optional[List[List[int]]] = None
    homography_dst_points: Optional[List[List[float]]] = None
    signal_mode: Optional[str] = "UNAVAILABLE"

class ViolationRecord(BaseModel):
    violation_id: str
    timestamp: str
    time: str
    vehicle_id: str
    vehicle_class: str
    violation_type: str
    license_plate: str
    ocr_confidence: float
    estimated_speed: Optional[float] = None
    speed_limit: float
    fine_amount: int
    reasoning: str
    start_frame: Optional[int] = None
    end_frame: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    evidence_image: str
    full_image: str
    location: str
    rc_status: str
    insurance_status: str
    puc_status: str
    vehicle_model: str
    owner: str

class ProcessorStatus(BaseModel):
    task_id: str
    status: str
    progress: int
    current_frame: int
    total_frames: int
    active_tracks_count: int
    violations_count: int
    signal_state: Optional[str] = "N/A"
    fps: Optional[float] = 0.0

class AnalyticsSummary(BaseModel):
    violations_by_type: Dict[str, int]
    violations_over_time: List[Dict[str, Any]]
    vehicle_types: Dict[str, int]
    total_violations: int
    compliance_summary: Dict[str, int] # e.g. {"insurance_expired": 2, "puc_expired": 1}

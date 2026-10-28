import cv2
import numpy as np
import os
from app.core.config import SAMPLES_DIR

def generate_synthetic_traffic_video():
    """
    Generates a synthetic traffic video containing vehicles, an intersection,
    a traffic light, a stop line, and simulated traffic violations.
    This provides a self-contained, zero-setup demonstration video.
    """
    video_path = os.path.join(SAMPLES_DIR, "sample_traffic.mp4")
    if os.path.exists(video_path):
        return video_path
        
    print("Generating synthetic traffic video for demonstration...")
    
    # Video details: 600 frames at 30 fps (20 seconds), resolution 800x600
    width, height = 800, 600
    fps = 30
    total_frames = 600
    
    # Define VideoWriter (use mp4v which is widely supported)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(video_path, fourcc, fps, (width, height))
    
    if not out.isOpened():
        # Fallback to AVI if MP4 fails on some environments
        video_path = os.path.join(SAMPLES_DIR, "sample_traffic.avi")
        fourcc = cv2.VideoWriter_fourcc(*'XVID')
        out = cv2.VideoWriter(video_path, fourcc, fps, (width, height))
        if not out.isOpened():
            print("Failed to initialize video writer.")
            return None
            
    # Set up coordinates for drawing
    # Road lanes
    road_x = 400
    road_width = 240
    stop_line_y = 350
    no_parking_zone = (50, 100, 200, 250) # x1, y1, x2, y2
    
    # Vehicles data: state tracking to render them smoothly
    # Vehicles list format: [id, type, x, y, speed_y, start_frame, end_frame, color, label, special_action]
    vehicles = [
        # Vehicle 1: Standard Car (Green Light pass - OK)
        {
            "id": 1, "type": "Car", "x": 330, "y": 620, "speed_y": -4, 
            "start": 10, "end": 180, "color": (120, 220, 120), "plate": "TN38AB1234",
            "helmet": "N/A"
        },
        # Vehicle 2: Speeding Car (Overspeeding - 72 km/h during Green)
        {
            "id": 2, "type": "Car", "x": 430, "y": 620, "speed_y": -9, 
            "start": 50, "end": 140, "color": (100, 150, 255), "plate": "TN38CD5678",
            "helmet": "N/A", "overspeed": True
        },
        # Vehicle 3: Red Light Runner (Crosses stop line during Red)
        {
            "id": 3, "type": "Car", "x": 330, "y": 620, "speed_y": -3, 
            "start": 160, "end": 420, "color": (80, 80, 240), "plate": "KA51MB9999",
            "helmet": "N/A", "red_light": True
        },
        # Vehicle 4: Motorcyclist without Helmet
        {
            "id": 4, "type": "Motorcycle", "x": 450, "y": 620, "speed_y": -3.5, 
            "start": 280, "end": 500, "color": (255, 200, 100), "plate": "DL3CBA7777",
            "helmet": "NO"
        },
        # Vehicle 5: Illegally Parked Car (Enters no-parking, stays 15+ seconds)
        {
            "id": 5, "type": "Car", "x": 100, "y": 620, "speed_y": -4, 
            "start": 30, "end": 590, "color": (200, 100, 200), "plate": "MH12QW4321",
            "helmet": "N/A", "park": True
        },
        # Vehicle 6: Stop Line Violator (Crosses stop line slightly and stops on Red)
        {
            "id": 6, "type": "Car", "x": 410, "y": 620, "speed_y": -3.5, 
            "start": 220, "end": 580, "color": (50, 200, 250), "plate": "TN38XX9876",
            "helmet": "N/A", "stop_line_violation": True
        }
    ]
    
    for f in range(total_frames):
        # 1. Determine Signal light state:
        # Green: frames 0-200, Yellow: frames 201-250, Red: 251-600
        if f <= 200:
            signal_state = "GREEN"
            signal_color = (0, 255, 0)
        elif f <= 250:
            signal_state = "YELLOW"
            signal_color = (0, 255, 255)
        else:
            signal_state = "RED"
            signal_color = (0, 0, 255)
            
        # Create dark blue dashboard style background
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:] = (20, 25, 35) # background dark theme color
        
        # 2. Draw Road
        cv2.rectangle(frame, (road_x - road_width//2, 0), (road_x + road_width//2, height), (40, 45, 50), -1)
        # Road lane divider dashes
        for y_dash in range(0, height, 40):
            cv2.line(frame, (road_x, y_dash), (road_x, y_dash + 20), (255, 255, 255), 2)
            
        # Draw Stop Line
        cv2.line(frame, (road_x - road_width//2, stop_line_y), (road_x + road_width//2, stop_line_y), (255, 255, 255), 5)
        cv2.putText(frame, "STOP LINE", (road_x - road_width//2 - 90, stop_line_y + 5), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        # Draw No Parking Zone
        x1, y1, x2, y2 = no_parking_zone
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
        # Transparent overlay for no parking zone
        overlay = frame.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 0, 100), -1)
        cv2.addWeighted(overlay, 0.3, frame, 0.7, 0, frame)
        cv2.putText(frame, "NO PARKING ZONE (15s)", (x1, y1 - 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 100, 255), 1)
        
        # Draw Signal Light Graphic
        cv2.rectangle(frame, (700, 50), (740, 170), (10, 10, 10), -1)
        # Red lamp
        cv2.circle(frame, (720, 75), 15, (0, 0, 100) if signal_state != "RED" else (0, 0, 255), -1)
        # Yellow lamp
        cv2.circle(frame, (720, 110), 15, (0, 100, 100) if signal_state != "YELLOW" else (0, 255, 255), -1)
        # Green lamp
        cv2.circle(frame, (720, 145), 15, (0, 100, 0) if signal_state != "GREEN" else (0, 255, 0), -1)
        cv2.putText(frame, f"SIGNAL: {signal_state}", (670, 40), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, signal_color, 2)
        
        # 3. Draw and update vehicles
        for v in vehicles:
            if f < v["start"] or f > v["end"]:
                continue
                
            # Update Position
            # Vehicle 5 (Park) drives to parking zone and stops
            if "park" in v:
                # Drive to zone
                target_y = y1 + 50
                target_x = x1 + 40
                if v["y"] > target_y:
                    v["y"] += v["speed_y"]
                if v["x"] > target_x:
                    v["x"] -= 2
            # Vehicle 6 (Stop Line Violation) crosses and stops during red
            elif "stop_line_violation" in v:
                target_y = stop_line_y - 20 # past stop line
                if signal_state == "RED" and v["y"] <= stop_line_y + 40:
                    # decelerate and stop past line
                    if v["y"] > target_y:
                        v["y"] += max(v["speed_y"] * 0.5, -1)
                    else:
                        v["y"] = target_y # Stop completely
                else:
                    v["y"] += v["speed_y"]
            # Vehicle 3 (Red Light runner)
            elif "red_light" in v:
                v["y"] += v["speed_y"]
            else:
                # Normal constant speed motion
                v["y"] += v["speed_y"]
                
            # Draw Vehicle rectangle/polygon
            vx, vy = int(v["x"]), int(v["y"])
            v_width, v_height = (36, 60) if v["type"] == "Car" else (20, 40)
            
            # Draw bounding box
            cv2.rectangle(frame, (vx - v_width//2, vy - v_height//2), (vx + v_width//2, vy + v_height//2), v["color"], -1)
            cv2.rectangle(frame, (vx - v_width//2, vy - v_height//2), (vx + v_width//2, vy + v_height//2), (255, 255, 255), 1)
            
            # Draw motorcycle details (wheels, rider head, helmet status)
            if v["type"] == "Motorcycle":
                # Draw wheels
                cv2.circle(frame, (vx, vy - 15), 5, (10, 10, 10), -1)
                cv2.circle(frame, (vx, vy + 15), 5, (10, 10, 10), -1)
                # Draw rider head
                head_color = (255, 255, 255) if v["helmet"] == "YES" else (50, 100, 240) # flesh/hair color
                cv2.circle(frame, (vx, vy - 5), 6, head_color, -1)
                if v["helmet"] == "YES":
                    # Draw a blue helmet arc
                    cv2.circle(frame, (vx, vy - 6), 7, (255, 0, 0), 2)
            else:
                # Draw windshield for Cars
                cv2.rectangle(frame, (vx - 14, vy - 15), (vx + 14, vy - 5), (200, 200, 255), -1)
                # Draw license plate graphic on rear
                cv2.rectangle(frame, (vx - 12, vy + 20), (vx + 12, vy + 27), (255, 255, 255), -1)
                cv2.putText(frame, v["plate"][:4], (vx - 10, vy + 26), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.25, (0, 0, 0), 1)
                
            # Draw tracking ID and class label
            cv2.putText(frame, f"{v['type'].upper()} #{v['id']}", (vx - v_width//2, vy - v_height//2 - 8), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 255, 200), 1)
            
            # Visual violations alerts directly embedded on screen
            if "overspeed" in v and vy < 550:
                cv2.putText(frame, "72 km/h", (vx + v_width//2 + 5, vy), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 255), 1)
                if vy < stop_line_y + 100:
                    cv2.putText(frame, "OVERSPEEDING", (vx - v_width//2, vy + v_height//2 + 12), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 255), 1)
            
            if "red_light" in v and vy <= stop_line_y and signal_state == "RED":
                cv2.putText(frame, "RED-LIGHT RUNNER", (vx - v_width//2 - 20, vy + v_height//2 + 12), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 255), 1)
                
            if "stop_line_violation" in v and vy <= stop_line_y and signal_state == "RED" and abs(v["speed_y"]) < 0.5:
                cv2.putText(frame, "STOP LINE VIOLATION", (vx - v_width//2 - 30, vy + v_height//2 + 12), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 255, 255), 1)
                
            if v["type"] == "Motorcycle" and v["helmet"] == "NO":
                cv2.putText(frame, "NO HELMET", (vx - v_width//2 - 10, vy + v_height//2 + 12), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 255), 1)
                
            if "park" in v and vy <= y2:
                # Calculate stationary duration (f - start of parking at frame 130)
                park_start_frame = 130
                if f > park_start_frame:
                    sec = (f - park_start_frame) // 30
                    cv2.putText(frame, f"Parked: {sec}s", (vx + v_width//2 + 5, vy), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 100, 200), 1)
                    if sec >= 15: # threshold
                        cv2.putText(frame, "ILLEGAL PARKING", (vx - v_width//2 - 15, vy + v_height//2 + 12), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 255), 1)
                        
        # 4. Calibration HUD info on top-left
        cv2.rectangle(frame, (10, 10), (220, 85), (30, 35, 45), -1)
        cv2.rectangle(frame, (10, 10), (220, 85), (80, 85, 95), 1)
        cv2.putText(frame, "TRAFFIC COMMAND CENTER", (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 255), 1)
        cv2.putText(frame, f"Frame: {f}/{total_frames}", (15, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1)
        cv2.putText(frame, "Speed Limit: 50 km/h", (15, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 200), 1)
        cv2.putText(frame, "Park Limit: 15 seconds", (15, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 200), 1)
        
        # Write Frame
        out.write(frame)
        
    out.release()
    print(f"Synthetic video generated successfully at: {video_path}")
    return video_path

if __name__ == "__main__":
    generate_synthetic_traffic_video()

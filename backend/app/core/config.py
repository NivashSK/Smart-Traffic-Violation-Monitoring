import os

# Fines Structure (Indian Rupees - INR)
# Stored in configuration rather than hardcoded in the logic
FINES_CONFIG = {
    "red_light_jumping": 1000,
    "stop_line_violation": 500,
    "overspeeding_lmv": 1000,          # Light Motor Vehicles (Cars)
    "overspeeding_heavy": 2000,        # Medium/Heavy vehicles (Buses, Trucks)
    "no_helmet": 1000,
    "illegal_parking_first": 500,
    "illegal_parking_subsequent": 1000
}

# General Configuration
DEFAULT_SPEED_LIMIT = 50.0 # km/h
PARKING_TIME_THRESHOLD = 15.0 # seconds (Shortened for dashboard demo visibility from 30s)

# Demonstration Vehicle Compliance Registry
# Predefined database of vehicle registration numbers to verify against extracted OCR plates.
# Alegitimate VAHAN/Parivahan API adapter could replace this service.
VEHICLE_REGISTRY = {
    "TN38AB1234": {
        "vehicle_model": "Honda Activa (Scooter)",
        "vehicle_type": "Motorcycle",
        "rc_status": "ACTIVE",
        "insurance_status": "VALID",
        "puc_status": "VALID",
        "owner": "Ravi Kumar"
    },
    "TN38CD5678": {
        "vehicle_model": "Hyundai i20 (Car)",
        "vehicle_type": "Car",
        "rc_status": "ACTIVE",
        "insurance_status": "EXPIRED",
        "puc_status": "VALID",
        "owner": "Priya Sharma"
    },
    "KA51MB9999": {
        "vehicle_model": "Tata Nexon EV (Car)",
        "vehicle_type": "Car",
        "rc_status": "ACTIVE",
        "insurance_status": "VALID",
        "puc_status": "EXPIRED",
        "owner": "Aditya Hegde"
    },
    "DL3CBA7777": {
        "vehicle_model": "Royal Enfield Classic 350",
        "vehicle_type": "Motorcycle",
        "rc_status": "SUSPENDED",
        "insurance_status": "VALID",
        "puc_status": "VALID",
        "owner": "Vikram Singh"
    },
    "MH12QW4321": {
        "vehicle_model": "Ashok Leyland Bus",
        "vehicle_type": "Bus",
        "rc_status": "ACTIVE",
        "insurance_status": "EXPIRED",
        "puc_status": "EXPIRED",
        "owner": "Express Travels Ltd."
    }
}

# Directories setup
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
DATA_DIR = os.path.join(BASE_DIR, "data")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
EVIDENCE_DIR = os.path.join(DATA_DIR, "evidence")
SAMPLES_DIR = os.path.join(DATA_DIR, "samples")
TRAFFIC_VIDEOS_DIR = os.path.join(DATA_DIR, "traffic_videos")

for path in [DATA_DIR, UPLOADS_DIR, EVIDENCE_DIR, SAMPLES_DIR, TRAFFIC_VIDEOS_DIR]:
    os.makedirs(path, exist_ok=True)

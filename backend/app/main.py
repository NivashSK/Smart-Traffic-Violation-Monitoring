from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api import endpoints
from app.core.synthetic_video import generate_synthetic_traffic_video
from app.core.config import DATA_DIR
import os

app = FastAPI(
    title="AI-Powered Smart Traffic Violation Monitoring System - API",
    description="Computer Vision & AI Traffic Compliance and e-Challan Generation Engine",
    version="1.0"
)

# Enable CORS for Next.js frontend communication
# We allow credentials and reflect origins for safety during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the static 'data' directory (Uploads, Evidence crops, Samples)
# This allows the frontend to stream processed videos and load evidence crops directly
app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")

# Startup events
@app.on_event("startup")
def setup_on_startup():
    # Make sure all directories exist
    os.makedirs(os.path.join(DATA_DIR, "uploads"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "evidence"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "samples"), exist_ok=True)
    
    # Pre-generate synthetic traffic video for instant demonstration
    generate_synthetic_traffic_video()
    print("Traffic monitoring setup complete and sample video generated.")

# Root health check endpoint
@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "AI Traffic Compliance Engine",
        "description": "Object Tracking, Violation Reasoning & Plate OCR API"
    }

# Register API Router
app.include_router(endpoints.router, prefix="/api/v1")

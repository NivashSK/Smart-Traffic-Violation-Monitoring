# 🛡️ Sentinel AI: Smart Traffic Violation Monitoring & Compliance System

> **Enterprise-grade Intelligent Transportation System (ITS) and Automated Enforcement Engine featuring YOLOv8 SAHI hyper-inference, 4-point perspective homography speed estimation, automated violation reasoning, and digital e-Challan generation.**

---

## 📌 Overview

**Sentinel AI** is an end-to-end computer vision and traffic intelligence system designed to automate traffic law enforcement. Operating on high-angle CCTV feeds and edge video streams, the system detects vehicles, tracks trajectories, evaluates infractions (red-light jumping, overspeeding, stop-line crossing, illegal parking, and helmet compliance), extracts license plates via ANPR, checks compliance against a VAHAN vehicle registry, and generates official digital e-Challans with forensic visual evidence.

---

## 🚀 Key Innovations & Features

### 1. 🔍 Small-Object Detection via SAHI (Slicing Aided Hyper Inference)
* Standard YOLO downscales video frames to 640×640, missing distant vehicles (15–25 px) near the camera horizon.
* Our tiled hyper-inference splits 1280×960 frames into **4 overlapping 720×540 slices**, runs high-resolution inference per tile, and remaps coordinates with Non-Maximum Suppression (NMS).
* **Benchmark Impact:** Boosted raw detections from **171 to 14,968** and persistent tracks from **2 to 232** on the real-world AI City Challenge CCTV footage.

### 2. 📐 Perspective-Aware 4-Point Homography Speed Estimation
* Standard 2D pixel displacement produces severe perspective distortion (vehicles near the camera appear artificially fast; vehicles far away appear stationary).
* We compute a planar homography projection matrix $H$ via `cv2.getPerspectiveTransform` mapping 4 image points to calibrated ground metric space (meters).
* Computes real-world speed (km/h) across a 10-frame sliding window with temporal median filtering and acceleration sanity limits.

### 3. 🎯 Event-Level Violation Deduplication Engine
* Prevents citation spam (e.g., a vehicle speeding for 3 seconds generating 90 separate citations).
* Tracks continuous violation episodes (`start_frame`, `end_frame`, `max_speed`).
* Merges tracker fragmentations caused by brief occlusions within 4.5 seconds and 120 pixels, reducing raw frame clutter down to clean, unique legal violation episodes.

### 4. 📹 Live MJPEG Processed Frame Streaming
* The FastAPI backend exposes an asynchronous multipart stream (`/api/v1/traffic/stream/{task_id}`).
* Operators view active vehicle bounding boxes, trajectory trails, and HUD telemetry live in real time as the backend processes the footage.

### 5. 🎛️ Interactive Scene Calibration Canvas
* Operators can load the first frame of any surveillance clip and interactively plot:
  * **Angled Stop Lines** (2-point segment crossing algorithm)
  * **Road Region Polygons** (filters out sidewalks, trees, and sky using `cv2.pointPolygonTest`)
  * **No-Parking Zones** (triggers stationary duration timers)
  * **4-Point Homography Quadrilaterals** (for metric ground calibration)
* Includes a **1-Click Preset Loader** for instant demonstration setup.

### 6. 📄 Official Digital e-Challan Notice Generator
* Automatically compiles official Ministry of Road Transport & Highways digital citations.
* Features **Dual-Evidence** forensics: Zoomed vehicle license plate crop + full intersection context frame.
* Incorporates Indian Motor Vehicles Act sections (Sec 119 for Red Light, Sec 183 for Speeding, Sec 194D for Helmet) and fine calculations in INR (₹).

### 7. 🏛️ VAHAN 4.0 Compliance Registry Gateway
* Integrates a federated query architecture simulating the National VAHAN/Parivahan vehicle registry.
* Cross-references detected plates for **Registration Certificate (RC)** validity, **Motor Insurance** status, and **Pollution Under Control (PUC)** certificates.

---

## 🏗️ System Architecture

```
 Traffic Footage (CCTV Stream / Demo MP4)
                    │
                    ▼
 YOLOv8n + SAHI Tiled Hyper-Inference (720x540 Overlapping Slices)
                    │
                    ▼
 Custom IoU Multi-Object Tracker & Velocity Profiler
                    │
                    ▼
 Planar Homography Engine (cv2.getPerspectiveTransform → km/h)
                    │
                    ▼
 Event-Level Deduplication & Fragment Merger Engine
                    │
                    ▼
 ANPR Pipeline (Bicubic Upscale + Otsu Thresholding + EasyOCR)
                    │
                    ▼
 VAHAN Vehicle Compliance Gateway (RC / Insurance / PUC Verification)
                    │
                    ▼
 Digital e-Challan & Forensic Evidence Generation
                    │
                    ▼
 Next.js 16 Tactical Command Center Dashboard (Live MJPEG Stream & Analytics)
```

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Recharts |
| **Backend API** | Python 3.11, FastAPI (Async ASGI), Uvicorn, Pydantic v2 |
| **Computer Vision & ML** | YOLOv8 Nano (`ultralytics`), SAHI Tiling, OpenCV (`cv2`), NumPy, EasyOCR (PyTorch) |
| **Streaming & Comms** | Multipart MJPEG (`multipart/x-mixed-replace`), RESTful APIs, Next.js Reverse Proxy Rewrites |

---

## 📂 Project Structure

```
Smart-Traffic-Violation-Monitoring/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints.py          # REST APIs (upload, process, stream, analytics)
│   │   │   └── schemas.py            # Pydantic schemas (TrafficConfig, ViolationRecord)
│   │   ├── core/
│   │   │   ├── config.py             # Fine structures, mock VAHAN database, directory paths
│   │   │   ├── synthetic_video.py    # Self-contained demo video generator
│   │   │   └── video_processor.py    # Detection, SAHI, IoU tracker, homography, deduplication
│   │   └── main.py                   # FastAPI application initialization & CORS
│   ├── run.py                        # Backend Uvicorn launcher script
│   ├── test_api.py                   # Comprehensive unit test suite (6/6 tests)
│   └── requirements.txt              # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css           # Aerospace command center styling & glassmorphism
│   │   │   ├── layout.tsx            # Root layout with Sentinel AI metadata
│   │   │   └── page.tsx              # Command Center Dashboard (Live monitor, canvas, analytics)
│   │   └── utils/
│   │       └── api.ts                # Frontend API client methods
│   ├── package.json                  # Next.js dependencies
│   ├── next.config.ts                # Reverse proxy rewrite rules
│   └── tsconfig.json                 # TypeScript compiler options
├── data/
│   └── samples/                      # Self-contained demonstration video (sample_traffic.mp4)
├── yolov8n.pt                        # Pre-trained YOLOv8 nano model weights (6.5 MB)
└── README.md                         # Project documentation
```

---

## ⚡ Getting Started

### Prerequisites
* **Python 3.10+** (Python 3.11 recommended)
* **Node.js 18+** and **npm**

---

### Step 1: Backend Setup

1. Open a terminal in the project root:
   ```bash
   cd backend
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the unit test suite to verify the pipeline:
   ```bash
   python test_api.py
   ```
   *(Expected: `Ran 6 tests ... OK`)*

4. Start the FastAPI backend server:
   ```bash
   python run.py
   ```
   *The backend will be live at `http://127.0.0.1:8000` (Interactive API docs at `http://127.0.0.1:8000/docs`).*

---

### Step 2: Frontend Setup

1. Open a second terminal:
   ```bash
   cd frontend
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```

4. Open **`http://localhost:3000`** in your browser.

---

## 🎬 How to Run the Demonstration

1. In the top-right header of the dashboard, click **`1-Click Demo`**.
2. The system automatically loads `sample_traffic.mp4`, applies the calibrated intersection parameters, and triggers the AI pipeline.
3. Observe:
   * **Live Stream:** Processed frames render live with tracker trails, speed tags, and HUD badges.
   * **Violation Feed:** Real-time citations trigger for overspeeding, red-light jumping, no helmet, and illegal parking.
   * **Inspect e-Challan:** Click on any citation to inspect the dual-evidence digital citation notice and print it.
   * **VAHAN Registry:** Switch to the registry tab to look up vehicle records (RC status, insurance validity, PUC).
   * **Analytics:** Review dynamic charts on violation categories, vehicle distribution, and timeline trends.

---

## 📊 Benchmark Results (AI City Challenge 2021 Track 1)

Empirical evaluation on 3,000 frames (1280×960, 10 FPS) high-angle intersection surveillance:

| Metric | Baseline (Standard YOLOv8n) | Sentinel AI (YOLOv8n + SAHI) | Improvement |
| :--- | :--- | :--- | :--- |
| **Raw Detections** | 171 | **14,968** | **+86.5x** (Overcomes small horizon downsampling) |
| **Persistent Tracks** | 2 tracks | **232 tracks** | **+115x** (Eliminates tracker dropout) |
| **Citation Deduplication** | 430 raw hits | **249 clean episodes** | **-42% noise** (True legal violation consolidation) |
| **Runtime Errors** | 0 | **0** | Clean, stable execution |

---

## 👤 Author

**Nivash SK**  
* GitHub: [@NivashSK](https://github.com/NivashSK)
* Email: [nivashkrishnakumar240@gmail.com](mailto:nivashkrishnakumar240@gmail.com)

---

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

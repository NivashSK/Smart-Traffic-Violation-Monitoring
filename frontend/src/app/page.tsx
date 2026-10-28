"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  uploadTrafficVideo,
  startVideoProcessing,
  fetchProcessingStatus,
  fetchViolations,
  fetchAnalytics,
  fetchSamples,
  fetchRegistry,
  terminateVideoProcessing,
  ViolationRecord,
  ProcessorStatus,
  AnalyticsSummary,
  SampleVideo
} from "../utils/api";
import {
  Activity,
  ShieldAlert,
  Zap,
  Sliders,
  Info,
  UploadCloud,
  ArrowRight,
  Navigation,
  CheckCircle,
  AlertTriangle,
  FileText,
  RefreshCw,
  Search,
  Eye,
  Video,
  Printer,
  X,
  Clock,
  User,
  Scale,
  Car,
  Camera,
  Layers,
  MapPin,
  Check,
  AlertCircle,
  Play,
  Square,
  Sparkles,
  Download,
  Filter,
  BarChart2,
  ExternalLink,
  ShieldCheck,
  Award,
  ChevronRight
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts";

export default function TrafficDashboard() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "monitor" | "violations" | "registry" | "analytics" | "about">("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // System Configuration State
  const [config, setConfig] = useState({
    stop_line_y: 350,
    speed_limit: 50,
    parking_limit: 15
  });

  // Selected footage states
  const [samples, setSamples] = useState<SampleVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string>("sample_traffic.mp4");
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  
  // Processing Task States
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<ProcessorStatus | null>(null);
  
  // Violations & Analytics States
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [selectedChallan, setSelectedChallan] = useState<ViolationRecord | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [violationFilter, setViolationFilter] = useState<string>("ALL");
  const [violationSearchQuery, setViolationSearchQuery] = useState<string>("");

  // Registry search tool state
  const [searchPlate, setSearchPlate] = useState("");
  const [registryDb, setRegistryDb] = useState<any>(null);
  const [searchResult, setSearchResult] = useState<any>(null);

  // Calibration Canvas & Overlay States
  const [calibrationMode, setCalibrationMode] = useState<boolean>(false);
  const [activeDrawTool, setActiveDrawTool] = useState<"stop_line" | "road_polygon" | "no_parking_polygon" | "speed_polygon" | "homography_src_points" | null>(null);
  const [tempPoints, setTempPoints] = useState<[number, number][]>([]);
  
  // Calibrated geometries
  const [calibratedStopLine, setCalibratedStopLine] = useState<number[][] | null>(null);
  const [calibratedRoadPolygon, setCalibratedRoadPolygon] = useState<number[][] | null>(null);
  const [calibratedNoParkingPolygon, setCalibratedNoParkingPolygon] = useState<number[][] | null>(null);
  const [calibratedSpeedPolygon, setCalibratedSpeedPolygon] = useState<number[][] | null>(null);
  const [calibratedHomographySrc, setCalibratedHomographySrc] = useState<number[][] | null>(null);
  const [signalMode, setSignalMode] = useState<string>("UNAVAILABLE");

  // Canvas Image Preview State
  const [previewImage, setPreviewImage] = useState<HTMLImageElement | null>(null);
  const [canvasLoading, setCanvasLoading] = useState<boolean>(false);

  // Clock state for tactical HUD
  const [currentTime, setCurrentTime] = useState<string>("");

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    loadInitialData();
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour12: false }) + " UTC+5:30");
    }, 1000);

    return () => {
      clearInterval(timer);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const loadInitialData = async () => {
    try {
      const [sampleData, viols, analyticsData, reg] = await Promise.all([
        fetchSamples().catch(() => []),
        fetchViolations().catch(() => []),
        fetchAnalytics().catch(() => null),
        fetchRegistry().catch(() => null)
      ]);
      setSamples(sampleData);
      setViolations(viols);
      setAnalytics(analyticsData);
      setRegistryDb(reg);
    } catch (err) {
      console.error("Initial load error:", err);
    }
  };

  // Automated Polling during active video analysis
  const startStatusPolling = (taskId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const status = await fetchProcessingStatus(taskId);
        setTaskStatus(status);

        // Fetch updated violation records and analytics summary
        const [updatedViolations, updatedAnalytics] = await Promise.all([
          fetchViolations().catch(() => []),
          fetchAnalytics().catch(() => null)
        ]);
        setViolations(updatedViolations);
        if (updatedAnalytics) setAnalytics(updatedAnalytics);

        if (status.status === "completed" || status.status === "failed" || status.status === "terminated") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setActiveTaskId(null);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1000);
  };

  // Upload Custom Footage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setUploadProgress("Uploading surveillance footage to edge node...");
    setError(null);
    try {
      const res = await uploadTrafficVideo(file);
      setSamples(prev => {
        if (prev.some(s => s.name === res.filename)) return prev;
        return [...prev, { name: res.filename, size: "Custom Uploaded Footage" }];
      });
      setSelectedVideo(res.filename);
      setUploadProgress("Footage uploaded successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to upload video. Ensure correct formats (MP4, AVI).");
      setUploadProgress(null);
    } finally {
      setLoading(false);
    }
  };

  // Trigger Async CV Video Processing
  const handleRunAnalysis = async (customSignalMode?: string) => {
    setLoading(true);
    setError(null);
    try {
      const activeSignal = customSignalMode || signalMode;
      const payload = {
        ...config,
        stop_line: calibratedStopLine,
        road_polygon: calibratedRoadPolygon,
        no_parking_polygon: calibratedNoParkingPolygon,
        speed_polygon: calibratedSpeedPolygon,
        homography_src_points: calibratedHomographySrc,
        homography_dst_points: calibratedHomographySrc ? [[0, 0], [10, 0], [10, 30], [0, 30]] : null,
        signal_mode: activeSignal
      };
      const res = await startVideoProcessing(selectedVideo, payload as any);
      setActiveTaskId(res.task_id);
      setTaskStatus({
        task_id: res.task_id,
        status: "starting",
        progress: 0,
        current_frame: 0,
        total_frames: selectedVideo === "sample_traffic.mp4" ? 600 : 3000,
        active_tracks_count: 0,
        violations_count: 0
      });
      
      setActiveTab("dashboard");
      startStatusPolling(res.task_id);
    } catch (err: any) {
      setError(err.message || "Failed to start processing.");
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Preset Demo for Review 2 Presentation
  const handleRunOneClickDemo = async () => {
    setSelectedVideo("sample_traffic.mp4");
    setSignalMode("DEMO");
    // Load calibrated preset
    handleLoadIntersectionPreset("sample_traffic.mp4");
    setTimeout(() => {
      handleRunAnalysis("DEMO");
    }, 300);
  };

  // Terminate Active Process
  const handleTerminateAnalysis = async () => {
    if (!activeTaskId) return;
    if (!window.confirm("Abort current video analysis task? All active video capture streams and threads will be safely released.")) return;
    
    setLoading(true);
    try {
      await terminateVideoProcessing(activeTaskId);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setActiveTaskId(null);
      setTaskStatus(prev => prev ? { ...prev, status: "terminated" } : null);
    } catch (err: any) {
      setError(err.message || "Failed to terminate task.");
    } finally {
      setLoading(false);
    }
  };

  // Preload Calibration Presets (Crucial for live presentations)
  const handleLoadIntersectionPreset = (videoName: string = selectedVideo) => {
    if (videoName === "sample_traffic.mp4") {
      setCalibratedStopLine([[250, 350], [550, 350]]);
      setCalibratedRoadPolygon([[240, 100], [560, 100], [620, 600], [180, 600]]);
      setCalibratedNoParkingPolygon([[50, 100], [200, 100], [200, 250], [50, 250]]);
      setCalibratedSpeedPolygon([[250, 300], [550, 300], [600, 500], [200, 500]]);
      setCalibratedHomographySrc([[250, 300], [550, 300], [600, 500], [200, 500]]);
      setConfig(prev => ({ ...prev, stop_line_y: 350, speed_limit: 50 }));
    } else {
      // Real AI City Surveillance camera preset (1280x960)
      setCalibratedStopLine([[320, 520], [960, 530]]);
      setCalibratedRoadPolygon([[200, 250], [1050, 250], [1280, 960], [0, 960]]);
      setCalibratedNoParkingPolygon([[50, 600], [220, 600], [220, 850], [50, 850]]);
      setCalibratedSpeedPolygon([[350, 450], [920, 450], [1150, 850], [150, 850]]);
      setCalibratedHomographySrc([[350, 450], [920, 450], [1150, 850], [150, 850]]);
      setConfig(prev => ({ ...prev, stop_line_y: 520, speed_limit: 45 }));
    }
  };

  // Canvas First Frame Preview Extractor
  const loadFirstFramePreview = () => {
    setCanvasLoading(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `/api/v1/traffic/preview?video_name=${selectedVideo}&t=${Date.now()}`;
    img.onload = () => {
      setPreviewImage(img);
      setCanvasLoading(false);
      setCalibrationMode(true);
    };
    img.onerror = () => {
      setCanvasLoading(false);
      setError("Failed to extract preview frame from selected video.");
    };
  };

  // Canvas Click Handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    
    const mappedX = Math.round(clientX * (canvas.width / rect.width));
    const mappedY = Math.round(clientY * (canvas.height / rect.height));

    if (!activeDrawTool) return;

    const newPts: [number, number][] = [...tempPoints, [mappedX, mappedY]];
    setTempPoints(newPts);

    if (activeDrawTool === "stop_line" && newPts.length === 2) {
      setCalibratedStopLine(newPts);
      setConfig(prev => ({ ...prev, stop_line_y: Math.round((newPts[0][1] + newPts[1][1]) / 2) }));
      setTempPoints([]);
      setActiveDrawTool(null);
    } else if (activeDrawTool === "homography_src_points" && newPts.length === 4) {
      setCalibratedHomographySrc(newPts);
      setTempPoints([]);
      setActiveDrawTool(null);
    }
  };

  const handleFinishPolygon = () => {
    if (tempPoints.length < 3) {
      alert("A polygon requires at least 3 vertices.");
      return;
    }
    if (activeDrawTool === "road_polygon") setCalibratedRoadPolygon(tempPoints);
    else if (activeDrawTool === "no_parking_polygon") setCalibratedNoParkingPolygon(tempPoints);
    else if (activeDrawTool === "speed_polygon") setCalibratedSpeedPolygon(tempPoints);
    
    setTempPoints([]);
    setActiveDrawTool(null);
  };

  // Canvas Redraw Logic
  useEffect(() => {
    if (!canvasRef.current || !previewImage) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = previewImage.naturalWidth || 800;
    canvas.height = previewImage.naturalHeight || 600;

    ctx.drawImage(previewImage, 0, 0, canvas.width, canvas.height);

    // Grid Overlay
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // 1. Road Polygon
    if (calibratedRoadPolygon && calibratedRoadPolygon.length > 0) {
      ctx.strokeStyle = "rgba(148, 163, 184, 0.8)";
      ctx.fillStyle = "rgba(148, 163, 184, 0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(calibratedRoadPolygon[0][0], calibratedRoadPolygon[0][1]);
      for (let i = 1; i < calibratedRoadPolygon.length; i++) {
        ctx.lineTo(calibratedRoadPolygon[i][0], calibratedRoadPolygon[i][1]);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }

    // 2. No Parking Polygon
    if (calibratedNoParkingPolygon && calibratedNoParkingPolygon.length > 0) {
      ctx.strokeStyle = "rgba(245, 158, 11, 0.9)";
      ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(calibratedNoParkingPolygon[0][0], calibratedNoParkingPolygon[0][1]);
      for (let i = 1; i < calibratedNoParkingPolygon.length; i++) {
        ctx.lineTo(calibratedNoParkingPolygon[i][0], calibratedNoParkingPolygon[i][1]);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }

    // 3. Speed Polygon
    if (calibratedSpeedPolygon && calibratedSpeedPolygon.length > 0) {
      ctx.strokeStyle = "rgba(6, 182, 212, 0.9)";
      ctx.fillStyle = "rgba(6, 182, 212, 0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(calibratedSpeedPolygon[0][0], calibratedSpeedPolygon[0][1]);
      for (let i = 1; i < calibratedSpeedPolygon.length; i++) {
        ctx.lineTo(calibratedSpeedPolygon[i][0], calibratedSpeedPolygon[i][1]);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }

    // 4. Stop Line
    if (calibratedStopLine && calibratedStopLine.length === 2) {
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(calibratedStopLine[0][0], calibratedStopLine[0][1]);
      ctx.lineTo(calibratedStopLine[1][0], calibratedStopLine[1][1]);
      ctx.stroke();
    }

    // 5. Homography Points
    if (calibratedHomographySrc && calibratedHomographySrc.length > 0) {
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(calibratedHomographySrc[0][0], calibratedHomographySrc[0][1]);
      for (let i = 1; i < calibratedHomographySrc.length; i++) {
        ctx.lineTo(calibratedHomographySrc[i][0], calibratedHomographySrc[i][1]);
      }
      ctx.closePath();
      ctx.stroke();

      calibratedHomographySrc.forEach((pt, i) => {
        ctx.fillStyle = "#a855f7";
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 6, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Draw active drawing points
    if (tempPoints.length > 0) {
      ctx.strokeStyle = "#38bdf8";
      ctx.fillStyle = "#38bdf8";
      ctx.lineWidth = 2;
      tempPoints.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 5, 0, 2 * Math.PI);
        ctx.fill();
      });
      if (tempPoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(tempPoints[0][0], tempPoints[0][1]);
        for (let i = 1; i < tempPoints.length; i++) {
          ctx.lineTo(tempPoints[i][0], tempPoints[i][1]);
        }
        ctx.stroke();
      }
    }
  }, [
    previewImage,
    calibratedStopLine,
    calibratedRoadPolygon,
    calibratedNoParkingPolygon,
    calibratedSpeedPolygon,
    calibratedHomographySrc,
    tempPoints,
    activeDrawTool
  ]);

  // Registry Search
  const handleRegistrySearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPlate || !registryDb) return;
    const cleanPlate = searchPlate.trim().toUpperCase();
    if (registryDb[cleanPlate]) {
      setSearchResult({ plate: cleanPlate, ...registryDb[cleanPlate] });
    } else {
      setSearchResult({ notFound: true, plate: cleanPlate });
    }
  };

  // Helper: Format INR
  const formatRupee = (val: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
  };

  const getTotalFine = () => {
    return violations.reduce((acc, curr) => acc + (curr.fine_amount || 0), 0);
  };

  // Filtered violations
  const filteredViolations = violations.filter(v => {
    const matchesFilter = violationFilter === "ALL" || v.violation_type.toUpperCase().includes(violationFilter);
    const matchesSearch = !violationSearchQuery || 
      v.violation_id.toLowerCase().includes(violationSearchQuery.toLowerCase()) ||
      v.license_plate.toLowerCase().includes(violationSearchQuery.toLowerCase()) ||
      v.vehicle_class.toLowerCase().includes(violationSearchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col font-sans bg-tech-grid">
      
      {/* --- TOP COMMAND CENTER HEADER --- */}
      <header className="glass-panel border-b border-slate-800/80 px-6 py-3.5 sticky top-0 z-50 bg-[#080d1a]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo & Platform Branding */}
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="bg-gradient-to-br from-cyan-500 via-sky-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center">
                <ShieldAlert className="h-6 w-6 text-slate-950 stroke-[2.5]" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-wider text-white font-mono flex items-center gap-2">
                  SENTINEL <span className="text-cyan-400">AI</span>
                </h1>
                <span className="text-[10px] bg-cyan-950/80 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/60 font-mono font-bold tracking-wide">
                  ITS ENTERPRISE v2.4
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium tracking-tight">
                Intelligent Transportation System & Automated Enforcement Engine
              </p>
            </div>
          </div>

          {/* Telemetry & Quick Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Live UTC/IST Clock */}
            <div className="hidden md:flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 shadow-inner">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              <span>{currentTime || "00:00:00 UTC+5:30"}</span>
            </div>

            {/* Node Camera Status */}
            <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
              <span className={`h-2.5 w-2.5 rounded-full ${activeTaskId ? "bg-emerald-400 animate-ping" : "bg-cyan-400"}`}></span>
              <span className={activeTaskId ? "text-emerald-300 font-semibold" : "text-slate-300"}>
                {activeTaskId ? "ACTIVE INFERENCE" : "NODE 01: READY"}
              </span>
            </div>

            {/* One-Click Demo Button */}
            <button
              onClick={handleRunOneClickDemo}
              disabled={loading || activeTaskId !== null}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-sky-500 hover:from-cyan-500 hover:to-sky-400 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 fill-current" />
              <span>1-Click Demo</span>
            </button>
          </div>
        </div>
      </header>

      {/* --- ENTERPRISE TAB CONTROLLER --- */}
      <nav className="max-w-7xl w-full mx-auto px-6 mt-6">
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-900/70 border border-slate-800/80 rounded-xl backdrop-blur-md shadow-lg">
          
          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "dashboard" 
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Activity className="h-4 w-4" /> Live Monitor & Feed
          </button>
          
          <button 
            onClick={() => setActiveTab("monitor")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "monitor" 
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Sliders className="h-4 w-4" /> Scene Calibration
          </button>
          
          <button 
            onClick={() => setActiveTab("violations")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all relative ${
              activeTab === "violations" 
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <FileText className="h-4 w-4" /> Violation Records
            {violations.length > 0 && (
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                activeTab === "violations" ? "bg-slate-950 text-cyan-400" : "bg-rose-500 text-white"
              }`}>
                {violations.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab("registry")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "registry" 
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <ShieldCheck className="h-4 w-4" /> VAHAN Compliance Registry
          </button>
          
          <button 
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "analytics" 
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <BarChart2 className="h-4 w-4" /> Intelligence & Analytics
          </button>
          
          <button 
            onClick={() => setActiveTab("about")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "about" 
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Award className="h-4 w-4" /> Review 2 Dossier
          </button>
        </div>
      </nav>

      {/* --- ERROR BANNER --- */}
      {error && (
        <div className="max-w-7xl w-full mx-auto px-6 mt-4">
          <div className="bg-rose-950/70 border border-rose-800/80 text-rose-200 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-mono shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* --- MAIN WORKSPACE --- */}
      <main className="max-w-7xl w-full mx-auto px-6 py-6 flex-1 flex flex-col gap-6">

        {/* =========================================================
            TAB 1: DASHBOARD MONITOR & LIVE TACTICAL CCTV FEED
           ========================================================= */}
        {activeTab === "dashboard" && (
          <div className="flex flex-col gap-6">
            
            {/* Top Telemetry KPI Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              
              {/* Card 1: Total Violations */}
              <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Violations Logged</span>
                  <div className="p-1.5 bg-rose-500/10 rounded-lg border border-rose-500/20">
                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-rose-400 font-mono">{violations.length}</span>
                  <span className="text-[10px] text-slate-500 font-mono">episodes</span>
                </div>
              </div>

              {/* Card 2: Active Vehicles Tracked */}
              <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Tracks</span>
                  <div className="p-1.5 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    <Navigation className="h-4 w-4 text-cyan-400" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-cyan-300 font-mono">
                    {taskStatus && taskStatus.status === "processing" ? taskStatus.active_tracks_count : 0}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">IoU trails</span>
                </div>
              </div>

              {/* Card 3: e-Challans Issued */}
              <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">e-Challans Prepared</span>
                  <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <FileText className="h-4 w-4 text-amber-400" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-400 font-mono">{violations.length}</span>
                  <span className="text-[10px] text-slate-500 font-mono">notices</span>
                </div>
              </div>

              {/* Card 4: Fines Collected */}
              <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Penalty Incurred</span>
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <Scale className="h-4 w-4 text-emerald-400" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-400 font-mono">{formatRupee(getTotalFine())}</span>
                </div>
              </div>

              {/* Card 5: Pipeline FPS / Status */}
              <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-slate-800 col-span-2 md:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Inference Speed</span>
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                    <Zap className="h-4 w-4 text-indigo-400" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-indigo-300 font-mono">
                    {taskStatus && taskStatus.fps ? taskStatus.fps.toFixed(1) : "—"}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">FPS</span>
                </div>
              </div>
            </div>

            {/* Main Center Grid: Live CCTV Feed (Left) + Live Violation Ticker (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Pane: CCTV Player & Video Controls */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                
                {/* Tactical Frame Player Container */}
                <div className="tactical-frame glass-panel-elevated rounded-2xl overflow-hidden relative shadow-2xl flex flex-col border-slate-800">
                  
                  {/* Top Feed Bar */}
                  <div className="bg-[#0b101f] px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                      </span>
                      <span className="text-xs font-bold text-slate-200 font-mono tracking-wide">
                        FEED: CAM-04 (INTERSECTION NORTH)
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                        {selectedVideo}
                      </span>
                    </div>

                    {/* Active Status Badge */}
                    <div className="flex items-center gap-2">
                      {taskStatus && taskStatus.status === "processing" ? (
                        <>
                          <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2.5 py-1 rounded font-mono font-bold animate-pulse">
                            FRAME {taskStatus.current_frame} / {taskStatus.total_frames}
                          </span>
                          <button 
                            onClick={handleTerminateAnalysis}
                            className="text-[10px] bg-rose-900/80 hover:bg-rose-700 text-rose-100 font-bold px-2.5 py-1 rounded border border-rose-700 transition-all cursor-pointer"
                          >
                            [ ABORT ]
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono">
                          STATUS: STANDBY
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Main Video Screen */}
                  <div className="relative aspect-video bg-[#040711] flex items-center justify-center overflow-hidden">
                    
                    {/* Scanner overlay line */}
                    {taskStatus && taskStatus.status === "processing" && (
                      <div className="scanner-overlay"></div>
                    )}

                    {/* Case 1: Initializing State */}
                    {taskStatus && taskStatus.status === "starting" && (
                      <div className="absolute inset-0 bg-[#040711] flex flex-col items-center justify-center p-6 z-20 text-center">
                        <RefreshCw className="h-10 w-10 text-cyan-400 animate-spin mb-3" />
                        <h3 className="text-sm font-bold text-white font-mono">INITIALIZING YOLOv8 + SAHI PIPELINE</h3>
                        <p className="text-xs text-slate-400 font-mono mt-1">Calibrating slicing grid & homography transform...</p>
                      </div>
                    )}

                    {/* Case 2: Active MJPEG Stream */}
                    {taskStatus && taskStatus.status === "processing" && (
                      <div className="w-full h-full relative flex items-center justify-center bg-black">
                        <img 
                          src={`/api/v1/traffic/stream/${taskStatus.task_id}`} 
                          alt="AI Live Telemetry Stream" 
                          className="w-full h-full object-contain"
                        />
                        
                        {/* Stream Telemetry HUD Overlays */}
                        <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-20">
                          <span className="text-[10px] bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-emerald-400 px-2.5 py-1 rounded font-mono flex items-center gap-1.5 shadow-lg">
                            <Activity className="h-3 w-3 text-emerald-400 animate-pulse" />
                            SAHI HYPER-INFERENCE ACTIVE
                          </span>
                          <span className="text-[10px] bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-cyan-300 px-2.5 py-1 rounded font-mono">
                            TRACKS: {taskStatus.active_tracks_count}
                          </span>
                        </div>

                        <div className="absolute bottom-3 right-3 z-20">
                          <span className="text-[10px] bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-slate-300 px-2.5 py-1 rounded font-mono">
                            PERSPECTIVE HOMOGRAPHY: ACTIVE
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Case 3: Idle / Ready State */}
                    {(!taskStatus || taskStatus.status === "idle" || taskStatus.status === "completed" || taskStatus.status === "terminated") && (
                      <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
                        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl mb-4 shadow-xl">
                          <Camera className="h-10 w-10 text-cyan-400" />
                        </div>
                        <h3 className="text-base font-bold text-white font-mono tracking-wide">
                          INTELLIGENT SURVEILLANCE READY
                        </h3>
                        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                          Select a footage clip and signal mode below, then trigger the AI engine to evaluate traffic rules, speed, and license compliance in real time.
                        </p>
                        
                        <div className="mt-5 flex gap-3">
                          <button
                            onClick={() => handleRunAnalysis()}
                            disabled={loading}
                            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
                          >
                            <Play className="h-4 w-4 fill-current" /> Run Pipeline
                          </button>
                          
                          <button
                            onClick={loadFirstFramePreview}
                            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                          >
                            <Sliders className="h-4 w-4 text-cyan-400" /> Calibrate Scene
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar (Visible during processing) */}
                  {taskStatus && taskStatus.status === "processing" && (
                    <div className="w-full bg-slate-900 h-1.5 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-sky-400 h-full transition-all duration-300 shadow-sm"
                        style={{ width: `${taskStatus.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>

                {/* Video Selection & Execution Controls Strip */}
                <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 border-slate-800">
                  
                  {/* Select Video */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <span className="text-xs font-bold text-slate-400 uppercase font-mono shrink-0">Source:</span>
                    <select
                      value={selectedVideo}
                      onChange={(e) => setSelectedVideo(e.target.value)}
                      className="glass-input text-xs rounded-lg px-3 py-2 w-full sm:w-64 font-mono font-medium focus:ring-cyan-500"
                    >
                      {samples.map((s, idx) => (
                        <option key={idx} value={s.name} className="bg-slate-900 text-white">
                          {s.name} ({s.size})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Signal Mode */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <span className="text-xs font-bold text-slate-400 uppercase font-mono shrink-0">Signal:</span>
                    <select
                      value={signalMode}
                      onChange={(e) => setSignalMode(e.target.value)}
                      className="glass-input text-xs rounded-lg px-3 py-2 font-mono font-medium focus:ring-cyan-500"
                    >
                      <option value="UNAVAILABLE" className="bg-slate-900 text-white">
                        SIGNAL UNAVAILABLE (REAL CCTV)
                      </option>
                      <option value="DEMO" className="bg-slate-900 text-white">
                        CONTROLLED DEMO (CYCLIC)
                      </option>
                    </select>
                  </div>

                  {/* Execute Button */}
                  <button
                    onClick={() => handleRunAnalysis()}
                    disabled={loading || activeTaskId !== null}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-lg transition-all shadow-md shadow-cyan-500/25 disabled:opacity-50 cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>START ANALYSIS</span>
                  </button>
                </div>
              </div>

              {/* Right Pane: Live Violation Feed & e-Challan Ticker */}
              <div className="flex flex-col gap-4">
                <div className="glass-panel p-4 rounded-2xl flex flex-col flex-1 border-slate-800">
                  
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-rose-400" />
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                        Violation Activity Ticker
                      </h3>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                      {violations.length} LOGGED
                    </span>
                  </div>

                  {/* Violations Scroll Area */}
                  <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                    {violations.length === 0 ? (
                      <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center">
                        <CheckCircle className="h-8 w-8 text-slate-600 mb-2" />
                        <span className="text-xs font-mono">No active violations detected yet.</span>
                        <span className="text-[10px] text-slate-600 mt-1">Footage is compliant or analysis is pending.</span>
                      </div>
                    ) : (
                      violations.slice().reverse().map((v, i) => (
                        <div 
                          key={i}
                          className="bg-slate-900/70 hover:bg-slate-850 border border-slate-800/90 hover:border-slate-700 p-3 rounded-xl transition-all flex flex-col gap-2 group shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-rose-400 flex items-center gap-1.5 font-mono">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                                {v.violation_type}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Ref: {v.violation_id} • {v.vehicle_class}
                              </span>
                            </div>
                            <span className="text-xs font-black text-emerald-400 font-mono">
                              {formatRupee(v.fine_amount)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                            <span className="text-slate-300 font-bold bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                              {v.license_plate}
                            </span>
                            <button
                              onClick={() => setSelectedChallan(v)}
                              className="text-cyan-400 hover:text-cyan-300 font-semibold text-[10px] flex items-center gap-1 cursor-pointer"
                            >
                              Inspect Challan <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 2: SCENE CALIBRATION CANVAS WORKSPACE
           ========================================================= */}
        {activeTab === "monitor" && (
          <div className="flex flex-col gap-6">
            
            {/* Header & Instructions */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-cyan-400" />
                  SCENE CALIBRATION & HOMOGRAPHY WORKSPACE
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Define virtual stop lines, restricted no-parking zones, road region filters, and 4-point perspective planes.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => handleLoadIntersectionPreset()}
                  className="flex items-center gap-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700 text-xs font-bold px-3.5 py-2 rounded-lg transition-all cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Load Scene Preset</span>
                </button>
                <button
                  onClick={loadFirstFramePreview}
                  disabled={canvasLoading}
                  className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold px-3.5 py-2 rounded-lg transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Load Video Preview</span>
                </button>
              </div>
            </div>

            {/* Main Calibration Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left: Canvas Area */}
              <div className="lg:col-span-2 glass-panel p-4 rounded-2xl flex flex-col gap-3 border-slate-800">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
                  <span>Interactive Calibration Canvas</span>
                  {activeDrawTool && (
                    <span className="text-cyan-400 font-bold animate-pulse">
                      TOOL: {activeDrawTool.toUpperCase()} ({tempPoints.length} points)
                    </span>
                  )}
                </div>

                <div className="relative aspect-video bg-[#040711] rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                  {canvasLoading && (
                    <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center z-20">
                      <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin" />
                    </div>
                  )}

                  {!previewImage && !canvasLoading ? (
                    <div className="text-center p-8 text-slate-500 flex flex-col items-center">
                      <Camera className="h-10 w-10 text-slate-600 mb-2" />
                      <p className="text-xs font-mono">Click "Load Video Preview" or "Load Scene Preset" above to begin calibration.</p>
                    </div>
                  ) : (
                    <canvas
                      ref={canvasRef}
                      onClick={handleCanvasClick}
                      className="w-full h-full object-contain cursor-crosshair"
                    />
                  )}
                </div>

                {/* Canvas Action Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <div className="flex gap-2">
                    {activeDrawTool && activeDrawTool.includes("polygon") && (
                      <button
                        onClick={handleFinishPolygon}
                        className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                      >
                        Finish Polygon ({tempPoints.length} pts)
                      </button>
                    )}
                    <button
                      onClick={() => setTempPoints([])}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      Clear Points
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setCalibratedStopLine(null);
                      setCalibratedRoadPolygon(null);
                      setCalibratedNoParkingPolygon(null);
                      setCalibratedSpeedPolygon(null);
                      setCalibratedHomographySrc(null);
                      setTempPoints([]);
                    }}
                    className="text-rose-400 hover:text-rose-300 text-xs font-mono cursor-pointer"
                  >
                    Reset All Geometries
                  </button>
                </div>
              </div>

              {/* Right: Tools & Threshold Parameters */}
              <div className="flex flex-col gap-4">
                
                {/* Drawing Tools Palette */}
                <div className="glass-panel p-4 rounded-2xl flex flex-col gap-3 border-slate-800">
                  <h3 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider border-b border-slate-800 pb-2">
                    Drafting Geometry Palette
                  </h3>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => { setActiveDrawTool("stop_line"); setTempPoints([]); }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono font-medium transition-all ${
                        activeDrawTool === "stop_line" 
                          ? "bg-rose-500/20 border-rose-500 text-rose-300" 
                          : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-850"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                        <span>Virtual Stop Line</span>
                      </div>
                      <span className="text-[10px] text-slate-500">2 Points</span>
                    </button>

                    <button
                      onClick={() => { setActiveDrawTool("road_polygon"); setTempPoints([]); }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono font-medium transition-all ${
                        activeDrawTool === "road_polygon" 
                          ? "bg-slate-500/20 border-slate-400 text-slate-200" 
                          : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-850"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                        <span>Road Region Polygon</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Polygon</span>
                    </button>

                    <button
                      onClick={() => { setActiveDrawTool("no_parking_polygon"); setTempPoints([]); }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono font-medium transition-all ${
                        activeDrawTool === "no_parking_polygon" 
                          ? "bg-amber-500/20 border-amber-500 text-amber-300" 
                          : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-850"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                        <span>No-Parking Zone</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Polygon</span>
                    </button>

                    <button
                      onClick={() => { setActiveDrawTool("homography_src_points"); setTempPoints([]); }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono font-medium transition-all ${
                        activeDrawTool === "homography_src_points" 
                          ? "bg-purple-500/20 border-purple-500 text-purple-300" 
                          : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-850"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                        <span>Ground Homography (4-pt)</span>
                      </div>
                      <span className="text-[10px] text-slate-500">4 Points</span>
                    </button>
                  </div>
                </div>

                {/* Fine Parameters Sliders */}
                <div className="glass-panel p-4 rounded-2xl flex flex-col gap-4 border-slate-800">
                  <h3 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider border-b border-slate-800 pb-2">
                    Enforcement Thresholds
                  </h3>

                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Speed Limit:</span>
                      <span className="text-cyan-400 font-bold">{config.speed_limit} km/h</span>
                    </div>
                    <input 
                      type="range"
                      min="20"
                      max="100"
                      step="5"
                      value={config.speed_limit}
                      onChange={(e) => setConfig(prev => ({ ...prev, speed_limit: Number(e.target.value) }))}
                      className="accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Parking Threshold:</span>
                      <span className="text-amber-400 font-bold">{config.parking_limit} sec</span>
                    </div>
                    <input 
                      type="range"
                      min="5"
                      max="60"
                      step="5"
                      value={config.parking_limit}
                      onChange={(e) => setConfig(prev => ({ ...prev, parking_limit: Number(e.target.value) }))}
                      className="accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Upload Custom Video Form */}
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[11px] font-mono text-slate-400 block mb-2">Upload Surveillance Clip:</span>
                    <label className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-850 border border-dashed border-slate-700 py-3 rounded-xl cursor-pointer transition-all">
                      <UploadCloud className="h-4 w-4 text-cyan-400" />
                      <span className="text-xs font-mono text-slate-300">Choose MP4/AVI File</span>
                      <input type="file" accept="video/mp4,video/avi" onChange={handleFileUpload} className="hidden" />
                    </label>
                    {uploadProgress && (
                      <span className="text-[10px] text-cyan-400 font-mono mt-1 block text-center">{uploadProgress}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 3: VIOLATION RECORDS & DATA TABLE
           ========================================================= */}
        {activeTab === "violations" && (
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-5 border-slate-800">
            
            {/* Header & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                  <FileText className="h-5 w-5 text-rose-400" />
                  AUTOMATED VIOLATION CITATION DATABASE
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Deduplicated enforcement records containing visual evidence crops and compliance status.
                </p>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search plate or ID..."
                  value={violationSearchQuery}
                  onChange={(e) => setViolationSearchQuery(e.target.value)}
                  className="glass-input text-xs rounded-lg pl-8 pr-3 py-2 w-full font-mono focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {["ALL", "RED LIGHT", "OVERSPEEDING", "HELMET", "PARKING"].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setViolationFilter(filter)}
                  className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    violationFilter === filter
                      ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20"
                      : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto rounded-xl border border-slate-800/80">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0b101f] text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Citation ID</th>
                    <th className="px-4 py-3.5">Evidence Crop</th>
                    <th className="px-4 py-3.5">License Plate</th>
                    <th className="px-4 py-3.5">Violation Category</th>
                    <th className="px-4 py-3.5">Vehicle Type</th>
                    <th className="px-4 py-3.5">Penalty (INR)</th>
                    <th className="px-4 py-3.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                  {filteredViolations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                        No violation citations match the current filter or search.
                      </td>
                    </tr>
                  ) : (
                    filteredViolations.map((v, i) => (
                      <tr key={i} className="hover:bg-slate-900/60 transition-colors">
                        <td className="px-4 py-3 font-bold text-white">{v.violation_id}</td>
                        <td className="px-4 py-3">
                          <img 
                            src={v.evidence_image} 
                            alt="Crop" 
                            className="h-9 w-14 object-cover rounded border border-slate-800 bg-black cursor-pointer"
                            onClick={() => setSelectedChallan(v)}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='grey'></svg>";
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded font-bold border border-slate-700">
                            {v.license_plate}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-rose-400 font-bold">{v.violation_type}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{v.vehicle_class}</td>
                        <td className="px-4 py-3 font-bold text-emerald-400">{formatRupee(v.fine_amount)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedChallan(v)}
                            className="bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer"
                          >
                            Inspect Notice
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 4: VAHAN COMPLIANCE REGISTRY GATEWAY
           ========================================================= */}
        {activeTab === "registry" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Search Portal */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 border-slate-800">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider block">
                  GOVERNMENT OF INDIA • MoRTH
                </span>
                <h3 className="text-sm font-bold text-white font-mono mt-1">
                  VAHAN 4.0 INTEGRATED GATEWAY
                </h3>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Query registration certificates (RC), motor insurance status, and emission pollution certificates (PUC).
              </p>

              <form onSubmit={handleRegistrySearch} className="flex flex-col gap-3">
                <input 
                  type="text" 
                  placeholder="e.g. TN38AB1234, TN38CD5678"
                  value={searchPlate}
                  onChange={(e) => setSearchPlate(e.target.value)}
                  className="glass-input text-xs uppercase px-3.5 py-2.5 rounded-xl font-mono focus:ring-cyan-500"
                />
                <button
                  type="submit"
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  Verify Compliance
                </button>
              </form>

              {/* Quick Preset Buttons */}
              <div className="pt-2 border-t border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 block mb-2 uppercase">Quick Test Plates:</span>
                <div className="flex flex-wrap gap-1.5">
                  {["TN38AB1234", "TN38CD5678", "KA51MB9999", "DL3CBA7777", "MH12QW4321"].map((plate) => (
                    <button
                      key={plate}
                      onClick={() => {
                        setSearchPlate(plate);
                        if (registryDb && registryDb[plate]) {
                          setSearchResult({ plate, ...registryDb[plate] });
                        }
                      }}
                      className="text-[10px] font-mono bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 px-2 py-1 rounded cursor-pointer transition-colors"
                    >
                      {plate}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Search Results Card */}
            <div className="md:col-span-2 glass-panel p-6 rounded-2xl flex flex-col gap-4 border-slate-800 justify-center">
              {!searchResult ? (
                <div className="text-center py-12 text-slate-500 font-mono text-xs">
                  Enter a vehicle registration plate number or click a quick plate above to review compliance.
                </div>
              ) : searchResult.notFound ? (
                <div className="text-center py-12 text-rose-400 font-mono text-xs">
                  Vehicle record for <span className="font-bold">{searchResult.plate}</span> not found in registry database.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-2xl font-black text-white font-mono">{searchResult.plate}</span>
                      <span className="text-xs text-slate-400 block mt-0.5">{searchResult.vehicle_model}</span>
                    </div>
                    <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-lg font-mono border border-slate-700">
                      Owner: {searchResult.owner}
                    </span>
                  </div>

                  {/* 3 Status Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block mb-1">Registration (RC)</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        searchResult.rc_status === "ACTIVE" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "bg-rose-950 text-rose-300 border border-rose-800"
                      }`}>
                        {searchResult.rc_status}
                      </span>
                    </div>

                    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block mb-1">Motor Insurance</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        searchResult.insurance_status === "VALID" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "bg-rose-950 text-rose-300 border border-rose-800"
                      }`}>
                        {searchResult.insurance_status}
                      </span>
                    </div>

                    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block mb-1">Pollution (PUC)</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        searchResult.puc_status === "VALID" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "bg-rose-950 text-rose-300 border border-rose-800"
                      }`}>
                        {searchResult.puc_status}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 5: INTELLIGENCE & ANALYTICS
           ========================================================= */}
        {activeTab === "analytics" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Violations by Category */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3 border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">
                Violations by Category
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={
                    analytics && analytics.violations_by_type 
                      ? Object.entries(analytics.violations_by_type).map(([k, v]) => ({ name: k, count: v }))
                      : []
                  }>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} interval={0} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", color: "#fff" }} />
                    <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Timeline Trends */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3 border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">
                Violation Frequency Over Time
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics?.violations_over_time || []}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", color: "#fff" }} />
                    <Area type="monotone" dataKey="count" stroke="#06b6d4" fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Vehicle Class Breakdown */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3 border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">
                Target Vehicle Class Distribution
              </h3>
              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={
                        analytics && analytics.vehicle_types 
                          ? Object.entries(analytics.vehicle_types).map(([k, v]) => ({ name: k, value: v }))
                          : []
                      }
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {["#38bdf8", "#818cf8", "#f43f5e", "#f59e0b", "#10b981"].map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", color: "#fff" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Compliance Health Share */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3 border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">
                Registry Compliance Audit Ratio
              </h3>
              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={
                        analytics && analytics.compliance_summary
                          ? [
                              { name: "Insurance Expired", value: analytics.compliance_summary.insurance_expired },
                              { name: "PUC Expired", value: analytics.compliance_summary.puc_expired },
                              { name: "RC Suspended", value: analytics.compliance_summary.rc_suspended },
                              { name: "Fully Compliant", value: analytics.compliance_summary.fully_compliant }
                            ]
                          : []
                      }
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {["#f43f5e", "#f59e0b", "#a855f7", "#10b981"].map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", color: "#fff" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 6: ACADEMIC METHODOLOGY & REVIEW 2 DOSSIER
           ========================================================= */}
        {activeTab === "about" && (
          <div className="flex flex-col gap-6">
            
            {/* Main Overview Card */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 border-slate-800">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider block">
                  CAPSTONE PROJECT DOCUMENTATION
                </span>
                <h2 className="text-lg font-bold text-white font-mono mt-1">
                  AI-Powered Smart Traffic Violation Monitoring & Compliance System
                </h2>
              </div>

              {/* High-Level Pipeline Architecture Flow */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                <span className="text-xs font-bold text-slate-300 font-mono uppercase block mb-3">
                  End-to-End Edge Intelligence Pipeline
                </span>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center text-xs font-mono">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-cyan-400 block font-bold">1. Capture</span>
                    <span className="text-[10px] text-slate-400">10-30 FPS CCTV</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-cyan-400 block font-bold">2. SAHI Tiling</span>
                    <span className="text-[10px] text-slate-400">4x 720x540 Slices</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-cyan-400 block font-bold">3. IoU Tracker</span>
                    <span className="text-[10px] text-slate-400">Trajectory History</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-cyan-400 block font-bold">4. Homography</span>
                    <span className="text-[10px] text-slate-400">4-pt Ground Matrix</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-cyan-400 block font-bold">5. ANPR & OCR</span>
                    <span className="text-[10px] text-slate-400">Otsu + EasyOCR</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-cyan-400 block font-bold">6. e-Challan</span>
                    <span className="text-[10px] text-slate-400">MVA Fine Notice</span>
                  </div>
                </div>
              </div>

              {/* Comparative Benchmark Table */}
              <div className="flex flex-col gap-2 pt-2">
                <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                  Empirical Benchmark: AI City Challenge 2021 Track 1 (3,000 Frames)
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#0b101f] text-slate-400 text-[10px] uppercase">
                      <tr>
                        <th className="px-4 py-3">Metric</th>
                        <th className="px-4 py-3">Standard YOLOv8n (Baseline)</th>
                        <th className="px-4 py-3 text-cyan-400">YOLOv8n + SAHI Tiled Inference</th>
                        <th className="px-4 py-3">Engineering Justification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-white">Raw Detections</td>
                        <td className="px-4 py-3 text-slate-400">171</td>
                        <td className="px-4 py-3 font-bold text-emerald-400">14,968</td>
                        <td className="px-4 py-3 text-slate-400">Overcomes small object downsampling in distant horizon.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-white">Persistent Tracks</td>
                        <td className="px-4 py-3 text-slate-400">2 tracks</td>
                        <td className="px-4 py-3 font-bold text-emerald-400">232 tracks</td>
                        <td className="px-4 py-3 text-slate-400">Continuous bounding boxes eliminate tracker dropout.</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-white">Event Deduplication</td>
                        <td className="px-4 py-3 text-slate-400">430 raw citations</td>
                        <td className="px-4 py-3 font-bold text-cyan-400">249 clean episodes</td>
                        <td className="px-4 py-3 text-slate-400">Consolidates frame-by-frame spam into legal violation episodes.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- FOOTER --- */}
      <footer className="border-t border-slate-800/80 px-6 py-4 mt-8 bg-[#050812] text-center text-xs text-slate-500 font-mono">
        &copy; {new Date().getFullYear()} SENTINEL AI • Intelligent Transportation Systems & Automated Compliance Division. All rights reserved.
      </footer>

      {/* =========================================================
          OFFICIAL DIGITAL E-CHALLAN MODAL CITATION NOTICE
         ========================================================= */}
      {selectedChallan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="glass-panel-elevated bg-[#090e1c] border border-cyan-500/30 rounded-2xl w-full max-w-2xl overflow-hidden relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            
            {/* Official Header Banner */}
            <div className="bg-gradient-to-r from-slate-950 via-[#0e162b] to-slate-950 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                  <ShieldAlert className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-widest block">
                    MINISTRY OF ROAD TRANSPORT & HIGHWAYS • TRAFFIC ENFORCEMENT
                  </span>
                  <h3 className="text-sm font-black text-white font-mono tracking-wider">
                    OFFICIAL DIGITAL TRAFFIC VIOLATION CITATION
                  </h3>
                </div>
              </div>
              <button 
                onClick={() => setSelectedChallan(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
              
              {/* Security Hologram Notice Strip */}
              <div className="bg-cyan-950/40 border border-cyan-800/60 text-center py-2 px-4 rounded-xl text-[10px] font-mono font-bold text-cyan-300 uppercase tracking-wider flex items-center justify-between">
                <span>DIGITALLY ISSUED NOTICE • ACT SEC 133</span>
                <span className="text-emerald-400">VERIFIED COMPLIANCE RECORD</span>
              </div>

              {/* Evidence Dual Screen (Crop + Scene) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">
                    Vehicle License Plate ROI (Zoomed)
                  </span>
                  <img 
                    src={selectedChallan.evidence_image} 
                    alt="License Plate Crop" 
                    className="w-full aspect-[4/3] object-cover rounded-xl border border-slate-800 bg-black shadow-md"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='grey'></svg>";
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">
                    Full Intersection Context Capture
                  </span>
                  <img 
                    src={selectedChallan.full_image} 
                    alt="Full Scene Frame" 
                    className="w-full aspect-[4/3] object-cover rounded-xl border border-slate-800 bg-black shadow-md"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='grey'></svg>";
                    }}
                  />
                </div>
              </div>

              {/* Citation Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase block mb-1">Citation Reference</span>
                  <span className="font-bold text-white text-sm">{selectedChallan.violation_id}</span>
                </div>
                
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase block mb-1">Infraction Category</span>
                  <span className="font-bold text-rose-400 text-sm">{selectedChallan.violation_type}</span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase block mb-1">Extracted Plate Number</span>
                  <span className="font-bold text-white text-sm">{selectedChallan.license_plate}</span>
                  <span className="text-[9px] text-slate-500 block mt-0.5">OCR Confidence: {selectedChallan.ocr_confidence}%</span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase block mb-1">Assessed Penalty</span>
                  <span className="font-bold text-emerald-400 text-base">{formatRupee(selectedChallan.fine_amount)}</span>
                  <span className="text-[8px] text-slate-500 block mt-0.5">Motor Vehicles Act, 1988</span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase block mb-1">Timestamp & Node</span>
                  <span className="text-slate-300 text-[11px] font-sans">{selectedChallan.timestamp}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">{selectedChallan.location}</span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase block mb-1">Estimated Speed</span>
                  <span className="text-slate-300 text-sm">
                    {selectedChallan.estimated_speed ? `${selectedChallan.estimated_speed} km/h` : "N/A"}
                  </span>
                  {selectedChallan.estimated_speed && (
                    <span className="text-[9px] text-slate-500 block mt-0.5">Speed Limit: {selectedChallan.speed_limit} km/h</span>
                  )}
                </div>
              </div>

              {/* Compliance Registry Audit Bar */}
              {selectedChallan.owner && (
                <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2 font-mono text-xs">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Registered Owner: <strong className="text-white">{selectedChallan.owner}</strong></span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                      Class: {selectedChallan.vehicle_class}
                    </span>
                  </div>
                  <div className="flex gap-2 text-[10px]">
                    <span className={`px-2 py-0.5 rounded ${selectedChallan.rc_status === "ACTIVE" ? "bg-emerald-950 text-emerald-300" : "bg-rose-950 text-rose-300"}`}>
                      RC: {selectedChallan.rc_status}
                    </span>
                    <span className={`px-2 py-0.5 rounded ${selectedChallan.insurance_status === "VALID" ? "bg-emerald-950 text-emerald-300" : "bg-rose-950 text-rose-300"}`}>
                      INSURANCE: {selectedChallan.insurance_status}
                    </span>
                    <span className={`px-2 py-0.5 rounded ${selectedChallan.puc_status === "VALID" ? "bg-emerald-950 text-emerald-300" : "bg-rose-950 text-rose-300"}`}>
                      PUC: {selectedChallan.puc_status}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-950 px-6 py-3.5 border-t border-slate-800 flex justify-between items-center">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Notice</span>
              </button>
              
              <button 
                onClick={() => setSelectedChallan(null)}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold px-4 py-1.5 rounded-lg transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

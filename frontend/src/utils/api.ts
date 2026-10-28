export const API_BASE_URL = "/api/v1";

export interface TrafficConfig {
  stop_line_y: number;
  speed_limit: number;
  parking_limit: number;
  stop_line?: number[][] | null;
  road_polygon?: number[][] | null;
  no_parking_polygon?: number[][] | null;
  speed_polygon?: number[][] | null;
  homography_src_points?: number[][] | null;
  homography_dst_points?: number[][] | null;
  signal_mode?: string;
}

export interface ViolationRecord {
  violation_id: string;
  timestamp: string;
  time: string;
  vehicle_id: string;
  vehicle_class: string;
  violation_type: string;
  license_plate: string;
  ocr_confidence: number;
  estimated_speed: number | null;
  speed_limit: number;
  fine_amount: number;
  reasoning: string;
  evidence_image: string;
  full_image: string;
  location: string;
  rc_status: string;
  insurance_status: string;
  puc_status: string;
  vehicle_model: string;
  owner: string;
}

export interface ProcessorStatus {
  task_id: string;
  status: string;
  progress: number;
  current_frame: number;
  total_frames: number;
  active_tracks_count: number;
  violations_count: number;
  signal_state?: string;
  fps?: number;
}

export interface AnalyticsSummary {
  violations_by_type: { [key: string]: number };
  violations_over_time: Array<{ time: string; count: number }>;
  vehicle_types: { [key: string]: number };
  total_violations: number;
  compliance_summary: {
    insurance_expired: number;
    puc_expired: number;
    rc_suspended: number;
    fully_compliant: number;
  };
}

export interface SampleVideo {
  name: string;
  size: string;
}

export async function uploadTrafficVideo(file: File): Promise<{ filename: string; video_path: string; status: string }> {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch(`${API_BASE_URL}/traffic/upload`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to upload traffic video");
  return response.json();
}

export async function startVideoProcessing(
  videoName: string,
  config: TrafficConfig
): Promise<{ task_id: string; status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/traffic/process?video_name=${encodeURIComponent(videoName)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error("Failed to start traffic processing");
  return response.json();
}

export async function fetchProcessingStatus(taskId: string): Promise<ProcessorStatus> {
  const response = await fetch(`${API_BASE_URL}/traffic/status/${taskId}`);
  if (!response.ok) throw new Error("Failed to fetch task status");
  return response.json();
}

export async function fetchViolations(): Promise<ViolationRecord[]> {
  const response = await fetch(`${API_BASE_URL}/traffic/violations`);
  if (!response.ok) throw new Error("Failed to fetch violations");
  return response.json();
}

export async function fetchAnalytics(): Promise<AnalyticsSummary> {
  const response = await fetch(`${API_BASE_URL}/traffic/analytics`);
  if (!response.ok) throw new Error("Failed to fetch analytics summary");
  return response.json();
}

export async function fetchSamples(): Promise<SampleVideo[]> {
  const response = await fetch(`${API_BASE_URL}/traffic/sample`);
  if (!response.ok) throw new Error("Failed to fetch sample videos");
  return response.json();
}

export async function fetchRegistry(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/traffic/registry`);
  if (!response.ok) throw new Error("Failed to fetch vehicle registry");
  return response.json();
}

export async function terminateVideoProcessing(taskId: string): Promise<{ status: string; task_id: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/traffic/terminate/${taskId}`, {
    method: "POST"
  });
  if (!response.ok) throw new Error("Failed to terminate task");
  return response.json();
}

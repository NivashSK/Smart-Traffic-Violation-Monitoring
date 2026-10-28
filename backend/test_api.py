import os
import sys
import unittest
import time
from fastapi.testclient import TestClient

# Add app directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.main import app

class TestTrafficMonitoringAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.test_config = {
            "stop_line_y": 350,
            "speed_limit": 50.0,
            "parking_limit": 15.0
        }

    def test_health_check(self):
        """Test health check endpoint."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")
        self.assertIn("Compliance Engine", response.json()["service"])

    def test_sample_videos_list(self):
        """Test list of preloaded sample videos."""
        response = self.client.get("/api/v1/traffic/sample")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertTrue(len(data) > 0)
        self.assertEqual(data[0]["name"], "sample_traffic.mp4")

    def test_demonstration_registry(self):
        """Test registry compliance list."""
        response = self.client.get("/api/v1/traffic/registry")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("TN38AB1234", data)
        self.assertEqual(data["TN38AB1234"]["rc_status"], "ACTIVE")
        self.assertEqual(data["TN38AB1234"]["insurance_status"], "VALID")

    def test_video_processing_pipeline(self):
        """Test video analysis trigger, task polling, and results generation."""
        # Trigger background analysis task
        trigger_url = "/api/v1/traffic/process?video_name=sample_traffic.mp4"
        response = self.client.post(trigger_url, json=self.test_config)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("task_id", data)
        self.assertEqual(data["status"], "started")
        
        task_id = data["task_id"]
        
        # Poll status once
        status_response = self.client.get(f"/api/v1/traffic/status/{task_id}")
        self.assertEqual(status_response.status_code, 200)
        status_data = status_response.json()
        self.assertEqual(status_data["task_id"], task_id)
        self.assertIn(status_data["status"], ["starting", "processing", "completed"])

    def test_violations_endpoint(self):
        """Test fetching the logged violations database."""
        response = self.client.get("/api/v1/traffic/violations")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)

    def test_analytics_endpoint(self):
        """Test fetching the aggregated violations dashboard reports."""
        response = self.client.get("/api/v1/traffic/analytics")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("violations_by_type", data)
        self.assertIn("violations_over_time", data)
        self.assertIn("vehicle_types", data)
        self.assertIn("compliance_summary", data)

if __name__ == "__main__":
    unittest.main()

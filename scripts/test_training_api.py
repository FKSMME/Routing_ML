"""
Test script for Training API endpoints.

This script tests the iterative training API:
- POST /api/training/start
- GET /api/training/jobs/{job_id}/status
- GET /api/training/jobs
- DELETE /api/training/jobs/{job_id}

Note: This test requires the FastAPI server to be running.
Run: cd backend && PYTHONPATH=.. python run_api.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import requests

# API base URL
BASE_URL = "http://localhost:8000/api/training"

# Test credentials (adjust as needed)
AUTH_HEADERS = {
    "Authorization": "Bearer test_token",  # Adjust if auth is required
}


def print_response(response):
    """Pretty print response."""
    print(f"  Status: {response.status_code}")
    if response.status_code < 400:
        try:
            print(f"  Response: {response.json()}")
        except:
            print(f"  Response: {response.text}")
    else:
        print(f"  Error: {response.text}")


def test_start_training():
    """Test POST /api/training/start"""
    print("\n[TEST] POST /api/training/start")

    payload = {
        "sample_size": 100,
        "strategy": "random",
    }

    response = requests.post(f"{BASE_URL}/start", json=payload, headers=AUTH_HEADERS)
    print_response(response)

    if response.status_code == 200:
        data = response.json()
        return data.get("job_id")
    return None


def test_get_job_status(job_id):
    """Test GET /api/training/jobs/{job_id}/status"""
    print(f"\n[TEST] GET /api/training/jobs/{job_id}/status")

    response = requests.get(f"{BASE_URL}/jobs/{job_id}/status", headers=AUTH_HEADERS)
    print_response(response)

    if response.status_code == 200:
        return response.json()
    return None


def test_list_jobs():
    """Test GET /api/training/jobs"""
    print("\n[TEST] GET /api/training/jobs")

    response = requests.get(f"{BASE_URL}/jobs", headers=AUTH_HEADERS)
    print_response(response)

    if response.status_code == 200:
        data = response.json()
        print(f"  Total jobs: {data.get('total', 0)}")
        return data.get("jobs", [])
    return []


def test_cancel_job(job_id):
    """Test DELETE /api/training/jobs/{job_id}"""
    print(f"\n[TEST] DELETE /api/training/jobs/{job_id}")

    response = requests.delete(f"{BASE_URL}/jobs/{job_id}", headers=AUTH_HEADERS)
    print_response(response)


def main():
    """Run all tests."""
    print("=" * 60)
    print("Training API Tests")
    print("=" * 60)
    print(f"\nBase URL: {BASE_URL}")
    print("Note: Ensure FastAPI server is running (cd backend && python run_api.py)")

    try:
        # Test 1: Start training
        job_id = test_start_training()
        if not job_id:
            print("\n[ERROR] Failed to start training job. Stopping tests.")
            return

        # Wait a moment for job to initialize
        time.sleep(1)

        # Test 2: Get job status
        status = test_get_job_status(job_id)
        if status:
            print(f"\n  Job Progress: {status.get('progress', 0):.1f}%")
            print(f"  Current Step: {status.get('current_step', 'N/A')}")

        # Wait for job to progress
        print("\n[INFO] Waiting for job to complete...")
        for _ in range(10):
            time.sleep(1)
            status = test_get_job_status(job_id)
            if status:
                progress = status.get("progress", 0)
                current_status = status.get("status", "UNKNOWN")
                print(f"  Progress: {progress:.1f}% - {current_status}")

                if current_status in ["SUCCEEDED", "FAILED"]:
                    break

        # Test 3: List all jobs
        jobs = test_list_jobs()
        print(f"\n  Recent jobs: {len(jobs)}")
        for job in jobs[:3]:  # Show first 3
            print(f"    - {job.get('job_id')}: {job.get('status')} ({job.get('progress', 0):.1f}%)")

        # Test 4: Cancel job (if still running)
        if status and status.get("status") == "RUNNING":
            test_cancel_job(job_id)

        print("\n" + "=" * 60)
        print("[OK] All tests completed!")
        print("=" * 60)

    except requests.exceptions.ConnectionError:
        print("\n[ERROR] Could not connect to API server.")
        print("Please ensure the server is running:")
        print("  cd backend && PYTHONPATH=.. python run_api.py")
    except Exception as e:
        print(f"\n[ERROR] Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()

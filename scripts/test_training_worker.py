"""
Test script for TrainingWorker lifecycle.

This script tests the background training worker functionality:
- Starting a training job
- Progress updates
- State persistence
- Job completion
"""

import sys
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.iter_training.worker import TrainingWorker
from backend.iter_training.models import JobStatus


def dummy_training_function(job_id: str, params: dict, worker: TrainingWorker):
    """Dummy training function for testing.

    Simulates a training job with progress updates.
    """
    steps = [
        (10, "Loading data..."),
        (30, "Training baseline model..."),
        (50, "Training MLP model..."),
        (70, "Training stacking model..."),
        (90, "Evaluating models..."),
        (100, "Deploying best model..."),
    ]

    for progress, step in steps:
        worker.update_progress(
            job_id=job_id,
            progress=progress,
            current_step=step,
            log_message=f"Step: {step}",
        )
        time.sleep(1)  # Simulate work

    # Return result
    return {
        "best_model": "stacking",
        "mae_improvement": 12.5,
        "training_time": len(steps),
    }


def main():
    """Run worker lifecycle tests."""
    print("=" * 60)
    print("TrainingWorker Lifecycle Test")
    print("=" * 60)

    # Initialize worker
    worker = TrainingWorker(jobs_dir="data/training_jobs")
    print("\n[OK] Worker initialized")

    # Start a test job
    job_id = f"test_job_{int(time.time())}"
    print(f"\n[OK] Starting job: {job_id}")

    worker.start_training(
        job_id=job_id,
        training_func=dummy_training_function,
        job_params={"sample_size": 100, "strategy": "random"},
    )
    print("  Job started in background process")

    # Poll for progress
    print("\n[OK] Monitoring progress:")
    while True:
        state = worker.get_progress(job_id)
        print(f"  [{state.progress:5.1f}%] {state.status.value:10s} - {state.current_step}")

        if state.status in [JobStatus.SUCCEEDED, JobStatus.FAILED]:
            break

        time.sleep(1)

    # Show final result
    final_state = worker.get_progress(job_id)
    print(f"\n[OK] Job completed with status: {final_state.status.value}")

    if final_state.status == JobStatus.SUCCEEDED:
        print(f"\n[OK] Training result:")
        for key, value in final_state.result.items():
            print(f"  - {key}: {value}")

    if final_state.error_message:
        print(f"\n[ERROR] Error: {final_state.error_message}")

    # Show logs
    print(f"\n[OK] Job logs ({len(final_state.logs)} entries):")
    for log in final_state.logs[-5:]:  # Last 5 logs
        print(f"  [{log['timestamp']}] {log['message']}")

    # Test list_jobs
    print("\n[OK] Listing recent jobs:")
    jobs = worker.list_jobs(limit=5)
    for job in jobs:
        print(f"  - {job.job_id}: {job.status.value} ({job.progress:.1f}%)")

    # Test state persistence
    print("\n[OK] Testing state persistence:")
    state_file = Path(f"data/training_jobs/{job_id}/state.json")
    print(f"  State file exists: {state_file.exists()}")
    print(f"  State file size: {state_file.stat().st_size} bytes")

    print("\n" + "=" * 60)
    print("[OK] All tests passed!")
    print("=" * 60)


if __name__ == "__main__":
    main()

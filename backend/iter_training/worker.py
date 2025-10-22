"""
Background training worker for iterative training.

This module implements a background worker that runs model training
in a separate process, allowing the web API to remain responsive.
Progress updates are written to JSON state files for real-time monitoring.

Architecture:
- Uses multiprocessing.Process for background execution
- State persistence via JSON files in data/training_jobs/<job_id>/
- Lock-based atomic writes for thread-safety
- Supports progress callbacks and cancellation
"""

from __future__ import annotations

import json
import logging
import multiprocessing
import os
import time
import traceback
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .models import JobStatus

logger = logging.getLogger(__name__)


@dataclass
class TrainingJobState:
    """State of a training job.

    Attributes:
        job_id: Unique job identifier
        status: Current job status (PENDING, RUNNING, SUCCEEDED, FAILED)
        progress: Progress percentage (0-100)
        current_step: Human-readable description of current step
        logs: List of log messages with timestamps
        started_at: When job execution started
        updated_at: When state was last updated
        completed_at: When job finished (if applicable)
        error_message: Error details if status=FAILED
        result: Training results (metrics, selected model, etc.)
    """
    job_id: str
    status: JobStatus = JobStatus.PENDING
    progress: float = 0.0
    current_step: str = "Initializing..."
    logs: List[Dict[str, str]] = field(default_factory=list)
    started_at: Optional[str] = None
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dictionary."""
        return {
            "job_id": self.job_id,
            "status": self.status.value,
            "progress": round(self.progress, 1),
            "current_step": self.current_step,
            "logs": self.logs,
            "started_at": self.started_at,
            "updated_at": self.updated_at,
            "completed_at": self.completed_at,
            "error_message": self.error_message,
            "result": self.result,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> TrainingJobState:
        """Create from dictionary."""
        return cls(
            job_id=data["job_id"],
            status=JobStatus(data["status"]),
            progress=data.get("progress", 0.0),
            current_step=data.get("current_step", ""),
            logs=data.get("logs", []),
            started_at=data.get("started_at"),
            updated_at=data.get("updated_at"),
            completed_at=data.get("completed_at"),
            error_message=data.get("error_message"),
            result=data.get("result"),
        )


class TrainingWorker:
    """Background worker for model training.

    This class manages background training jobs using multiprocessing.
    Each job runs in a separate process and writes progress updates
    to a JSON state file.

    Usage:
        worker = TrainingWorker()
        job_id = worker.start_training(
            training_func=my_training_function,
            job_params={"sample_size": 100}
        )

        # Poll for progress
        state = worker.get_progress(job_id)
        print(f"Progress: {state.progress}%")
    """

    def __init__(self, jobs_dir: str = "data/training_jobs"):
        """Initialize worker.

        Args:
            jobs_dir: Directory to store job state files
        """
        self.jobs_dir = Path(jobs_dir)
        self.jobs_dir.mkdir(parents=True, exist_ok=True)
        self.processes: Dict[str, multiprocessing.Process] = {}
        logger.info(f"TrainingWorker initialized with jobs_dir: {self.jobs_dir}")

    def start_training(
        self,
        job_id: str,
        training_func: Callable,
        job_params: Dict[str, Any],
    ) -> str:
        """Start a background training job.

        Args:
            job_id: Unique job identifier
            training_func: Training function to execute (must accept job_id, params)
            job_params: Parameters to pass to training function

        Returns:
            job_id: The job ID for tracking

        Raises:
            ValueError: If job_id already exists
        """
        # Check if job already exists
        if job_id in self.processes:
            raise ValueError(f"Job {job_id} already exists")

        job_dir = self.jobs_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        # Initialize job state
        state = TrainingJobState(
            job_id=job_id,
            status=JobStatus.PENDING,
            started_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
        )
        self._write_state(job_id, state)

        # Create and start process
        process = multiprocessing.Process(
            target=self._run_training_wrapper,
            args=(job_id, training_func, job_params),
            name=f"training-{job_id}"
        )
        process.start()
        self.processes[job_id] = process

        logger.info(f"Started training job {job_id} in process {process.pid}")
        return job_id

    def _run_training_wrapper(
        self,
        job_id: str,
        training_func: Callable,
        job_params: Dict[str, Any],
    ) -> None:
        """Wrapper for training function with error handling.

        This runs in the child process.
        """
        try:
            # Update to RUNNING
            self.update_progress(
                job_id=job_id,
                progress=0.0,
                current_step="Training started",
                status=JobStatus.RUNNING,
            )

            # Execute training function
            result = training_func(job_id, job_params, self)

            # Mark as succeeded
            state = self._read_state(job_id)
            state.status = JobStatus.SUCCEEDED
            state.progress = 100.0
            state.current_step = "Training completed successfully"
            state.completed_at = datetime.now().isoformat()
            state.updated_at = datetime.now().isoformat()
            state.result = result
            self._write_state(job_id, state)

            logger.info(f"Training job {job_id} completed successfully")

        except Exception as e:
            # Mark as failed
            error_msg = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
            logger.error(f"Training job {job_id} failed: {error_msg}")

            state = self._read_state(job_id)
            state.status = JobStatus.FAILED
            state.current_step = "Training failed"
            state.completed_at = datetime.now().isoformat()
            state.updated_at = datetime.now().isoformat()
            state.error_message = error_msg
            self._write_state(job_id, state)

    def update_progress(
        self,
        job_id: str,
        progress: float,
        current_step: str,
        status: Optional[JobStatus] = None,
        log_message: Optional[str] = None,
    ) -> None:
        """Update job progress.

        This method is called by the training function to report progress.
        It's thread-safe and can be called from the child process.

        Args:
            job_id: Job identifier
            progress: Progress percentage (0-100)
            current_step: Human-readable description of current step
            status: Optional status update
            log_message: Optional log message to append
        """
        state = self._read_state(job_id)

        state.progress = progress
        state.current_step = current_step
        state.updated_at = datetime.now().isoformat()

        if status is not None:
            state.status = status

        if log_message:
            state.logs.append({
                "timestamp": datetime.now().isoformat(),
                "message": log_message,
            })

        self._write_state(job_id, state)
        logger.debug(f"Job {job_id}: {progress:.1f}% - {current_step}")

    def get_progress(self, job_id: str) -> TrainingJobState:
        """Get current job progress.

        Args:
            job_id: Job identifier

        Returns:
            Current job state

        Raises:
            FileNotFoundError: If job doesn't exist
        """
        return self._read_state(job_id)

    def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job.

        Args:
            job_id: Job identifier

        Returns:
            True if job was cancelled, False if not running
        """
        if job_id not in self.processes:
            logger.warning(f"Job {job_id} not found in active processes")
            return False

        process = self.processes[job_id]
        if process.is_alive():
            process.terminate()
            process.join(timeout=5)

            # Force kill if still alive
            if process.is_alive():
                process.kill()
                process.join()

            # Update state
            state = self._read_state(job_id)
            state.status = JobStatus.FAILED
            state.current_step = "Cancelled by user"
            state.completed_at = datetime.now().isoformat()
            state.updated_at = datetime.now().isoformat()
            state.error_message = "Job cancelled by user"
            self._write_state(job_id, state)

            logger.info(f"Cancelled job {job_id}")
            del self.processes[job_id]
            return True

        return False

    def list_jobs(self, limit: int = 100) -> List[TrainingJobState]:
        """List recent jobs.

        Args:
            limit: Maximum number of jobs to return

        Returns:
            List of job states, sorted by started_at (newest first)
        """
        jobs = []
        for job_dir in self.jobs_dir.iterdir():
            if not job_dir.is_dir():
                continue

            state_file = job_dir / "state.json"
            if not state_file.exists():
                continue

            try:
                state = self._read_state(job_dir.name)
                jobs.append(state)
            except Exception as e:
                logger.warning(f"Failed to read state for job {job_dir.name}: {e}")

        # Sort by started_at (newest first)
        jobs.sort(key=lambda x: x.started_at or "", reverse=True)
        return jobs[:limit]

    def cleanup_old_jobs(self, max_age_days: int = 30) -> int:
        """Clean up old job directories.

        Args:
            max_age_days: Delete jobs older than this many days

        Returns:
            Number of jobs deleted
        """
        deleted = 0
        cutoff_time = time.time() - (max_age_days * 24 * 60 * 60)

        for job_dir in self.jobs_dir.iterdir():
            if not job_dir.is_dir():
                continue

            state_file = job_dir / "state.json"
            if not state_file.exists():
                continue

            # Check file modification time
            if state_file.stat().st_mtime < cutoff_time:
                try:
                    # Remove entire job directory
                    import shutil
                    shutil.rmtree(job_dir)
                    deleted += 1
                    logger.info(f"Deleted old job {job_dir.name}")
                except Exception as e:
                    logger.warning(f"Failed to delete job {job_dir.name}: {e}")

        return deleted

    def _get_state_file(self, job_id: str) -> Path:
        """Get state file path for job."""
        return self.jobs_dir / job_id / "state.json"

    def _read_state(self, job_id: str) -> TrainingJobState:
        """Read job state from file.

        Uses file locking for thread-safety.
        """
        state_file = self._get_state_file(job_id)

        if not state_file.exists():
            raise FileNotFoundError(f"Job {job_id} not found")

        # Read with retry (in case of concurrent writes)
        max_retries = 3
        for attempt in range(max_retries):
            try:
                with open(state_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return TrainingJobState.from_dict(data)
            except json.JSONDecodeError as e:
                if attempt < max_retries - 1:
                    time.sleep(0.1)
                else:
                    raise ValueError(f"Failed to parse state file for job {job_id}: {e}")

    def _write_state(self, job_id: str, state: TrainingJobState) -> None:
        """Write job state to file.

        Uses atomic write (write to temp file, then rename) for thread-safety.
        """
        state_file = self._get_state_file(job_id)
        state_file.parent.mkdir(parents=True, exist_ok=True)

        # Atomic write: write to temp file, then rename
        temp_file = state_file.with_suffix(".tmp")
        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(state.to_dict(), f, indent=2, ensure_ascii=False)

            # Atomic rename
            temp_file.replace(state_file)
        except Exception as e:
            # Clean up temp file on error
            if temp_file.exists():
                temp_file.unlink()
            raise RuntimeError(f"Failed to write state for job {job_id}: {e}")

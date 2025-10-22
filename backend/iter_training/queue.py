"""
Retraining job queue management.

This module implements a JSON file-based queue for managing
retraining jobs triggered by quality degradation.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .models import JobStatus, RetrainingJob
from .config_loader import get_config

logger = logging.getLogger(__name__)


class RetrainingQueue:
    """JSON file-based queue for retraining jobs.

    Provides thread-safe operations for enqueueing, dequeuing,
    and managing retraining jobs.
    """

    def __init__(self, queue_file: Optional[str] = None):
        """Initialize retraining queue.

        Args:
            queue_file: Path to queue JSON file. If None, uses config default.
        """
        config = get_config()
        self.queue_file = Path(queue_file or config.queue.queue_file)
        self.max_size = config.queue.max_size
        self.max_retries = config.queue.max_retries

        # Ensure queue file exists
        self.queue_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.queue_file.exists():
            self._save_queue([])

        logger.info(f"Retraining queue initialized: {self.queue_file}")

    def enqueue(
        self,
        cycle_id: str,
        metrics: dict,
        items: Optional[List[str]] = None,
    ) -> Optional[RetrainingJob]:
        """Add a new retraining job to the queue.

        Args:
            cycle_id: Quality cycle that triggered this job
            metrics: Quality metrics that triggered retraining
            items: Optional list of specific items to focus on

        Returns:
            RetrainingJob if successfully enqueued, None if queue full
        """
        queue = self._load_queue()

        # Check queue size (count pending/running jobs)
        active_jobs = [
            j for j in queue
            if j["status"] in [JobStatus.PENDING.value, JobStatus.RUNNING.value]
        ]

        if len(active_jobs) >= self.max_size:
            logger.warning(f"Queue full ({len(active_jobs)}/{self.max_size}), deferring job for cycle {cycle_id}")

            # Create deferred job (not added to queue)
            job = RetrainingJob(
                queue_id=f"retrain_{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}",
                cycle_id=cycle_id,
                metrics=metrics,
                items=items or [],
                status=JobStatus.DEFERRED,
            )
            return job

        # Create new job
        job = RetrainingJob(
            queue_id=f"retrain_{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}",
            cycle_id=cycle_id,
            metrics=metrics,
            items=items or [],
            status=JobStatus.PENDING,
        )

        # Add to queue
        queue.append(job.to_dict())
        self._save_queue(queue)

        logger.info(f"Enqueued retraining job: {job.queue_id} (cycle: {cycle_id})")
        return job

    def dequeue(self) -> Optional[RetrainingJob]:
        """Get the next pending job from the queue.

        Marks the job as RUNNING and returns it.

        Returns:
            RetrainingJob if available, None if queue empty
        """
        queue = self._load_queue()

        # Find first pending job
        for i, job_dict in enumerate(queue):
            if job_dict["status"] == JobStatus.PENDING.value:
                # Update status to running
                job_dict["status"] = JobStatus.RUNNING.value
                job_dict["started_at"] = datetime.utcnow().isoformat()
                job_dict["updated_at"] = datetime.utcnow().isoformat()

                self._save_queue(queue)

                job = self._dict_to_job(job_dict)
                logger.info(f"Dequeued job: {job.queue_id}")
                return job

        return None

    def update_status(
        self,
        queue_id: str,
        status: JobStatus,
        error_message: Optional[str] = None,
        result: Optional[dict] = None,
    ) -> bool:
        """Update the status of a job.

        Args:
            queue_id: Job identifier
            status: New status
            error_message: Error message if status=FAILED
            result: Training results if status=SUCCEEDED

        Returns:
            True if job found and updated, False otherwise
        """
        queue = self._load_queue()

        for job_dict in queue:
            if job_dict["queue_id"] == queue_id:
                job_dict["status"] = status.value
                job_dict["updated_at"] = datetime.utcnow().isoformat()

                if status in [JobStatus.SUCCEEDED, JobStatus.FAILED, JobStatus.SKIPPED]:
                    job_dict["completed_at"] = datetime.utcnow().isoformat()

                if error_message:
                    job_dict["error_message"] = error_message

                if result:
                    job_dict["result"] = result

                self._save_queue(queue)
                logger.info(f"Updated job {queue_id} status: {status.value}")
                return True

        logger.warning(f"Job not found: {queue_id}")
        return False

    def retry(self, queue_id: str) -> bool:
        """Retry a failed job.

        Args:
            queue_id: Job identifier

        Returns:
            True if job retried, False if max retries exceeded or job not found
        """
        queue = self._load_queue()

        for job_dict in queue:
            if job_dict["queue_id"] == queue_id:
                if job_dict["retry_count"] >= self.max_retries:
                    logger.warning(f"Job {queue_id} exceeded max retries ({self.max_retries})")
                    return False

                # Reset to pending
                job_dict["status"] = JobStatus.PENDING.value
                job_dict["retry_count"] += 1
                job_dict["updated_at"] = datetime.utcnow().isoformat()
                job_dict["error_message"] = None

                self._save_queue(queue)
                logger.info(f"Retrying job {queue_id} (attempt {job_dict['retry_count'] + 1})")
                return True

        logger.warning(f"Job not found: {queue_id}")
        return False

    def get_status(self, queue_id: Optional[str] = None) -> dict:
        """Get queue status or specific job status.

        Args:
            queue_id: Optional job identifier. If None, returns queue summary.

        Returns:
            Status dictionary
        """
        queue = self._load_queue()

        if queue_id:
            # Get specific job
            for job_dict in queue:
                if job_dict["queue_id"] == queue_id:
                    return job_dict

            return {"error": f"Job not found: {queue_id}"}

        # Get queue summary
        status_counts = {
            "pending": 0,
            "running": 0,
            "succeeded": 0,
            "failed": 0,
            "deferred": 0,
            "skipped": 0,
        }

        for job_dict in queue:
            status = job_dict["status"]
            status_counts[status] = status_counts.get(status, 0) + 1

        return {
            "total_jobs": len(queue),
            "max_size": self.max_size,
            "status_counts": status_counts,
            "queue_file": str(self.queue_file),
        }

    def get_all_jobs(
        self,
        status_filter: Optional[JobStatus] = None,
        limit: int = 100,
    ) -> List[RetrainingJob]:
        """Get all jobs from the queue.

        Args:
            status_filter: Optional status to filter by
            limit: Maximum number of jobs to return

        Returns:
            List of RetrainingJob objects
        """
        queue = self._load_queue()

        jobs = []
        for job_dict in queue[:limit]:
            if status_filter and job_dict["status"] != status_filter.value:
                continue

            jobs.append(self._dict_to_job(job_dict))

        return jobs

    def clear_completed(self, days: int = 7) -> int:
        """Clear completed jobs older than specified days.

        Args:
            days: Age threshold in days

        Returns:
            Number of jobs removed
        """
        queue = self._load_queue()
        cutoff = datetime.utcnow().timestamp() - (days * 86400)

        removed = 0
        new_queue = []

        for job_dict in queue:
            status = job_dict["status"]
            completed_at = job_dict.get("completed_at")

            if status in [JobStatus.SUCCEEDED.value, JobStatus.FAILED.value, JobStatus.SKIPPED.value]:
                if completed_at:
                    completed_ts = datetime.fromisoformat(completed_at).timestamp()
                    if completed_ts < cutoff:
                        removed += 1
                        continue

            new_queue.append(job_dict)

        if removed > 0:
            self._save_queue(new_queue)
            logger.info(f"Cleared {removed} completed jobs older than {days} days")

        return removed

    def _load_queue(self) -> List[dict]:
        """Load queue from JSON file.

        Returns:
            List of job dictionaries
        """
        try:
            with open(self.queue_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logger.warning(f"Failed to load queue, creating empty: {e}")
            self._save_queue([])
            return []

    def _save_queue(self, queue: List[dict]) -> None:
        """Save queue to JSON file.

        Args:
            queue: List of job dictionaries
        """
        try:
            with open(self.queue_file, "w", encoding="utf-8") as f:
                json.dump(queue, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to save queue: {e}", exc_info=True)

    def _dict_to_job(self, job_dict: dict) -> RetrainingJob:
        """Convert dictionary to RetrainingJob object.

        Args:
            job_dict: Job dictionary from queue

        Returns:
            RetrainingJob object
        """
        return RetrainingJob(
            queue_id=job_dict["queue_id"],
            cycle_id=job_dict["cycle_id"],
            items=job_dict.get("items", []),
            metrics=job_dict["metrics"],
            status=JobStatus(job_dict["status"]),
            created_at=datetime.fromisoformat(job_dict["created_at"]),
            updated_at=datetime.fromisoformat(job_dict["updated_at"]),
            started_at=datetime.fromisoformat(job_dict["started_at"]) if job_dict.get("started_at") else None,
            completed_at=datetime.fromisoformat(job_dict["completed_at"]) if job_dict.get("completed_at") else None,
            error_message=job_dict.get("error_message"),
            retry_count=job_dict.get("retry_count", 0),
            result=job_dict.get("result"),
        )


# Singleton instance
_queue_instance: Optional[RetrainingQueue] = None


def get_queue() -> RetrainingQueue:
    """Get the singleton retraining queue instance.

    Returns:
        RetrainingQueue instance
    """
    global _queue_instance
    if _queue_instance is None:
        _queue_instance = RetrainingQueue()
    return _queue_instance

"""Cross-platform file lock utility for coordinating long-running jobs."""
from __future__ import annotations

import os
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Optional


class FileLockTimeout(RuntimeError):
    """Raised when a file lock cannot be acquired within the timeout."""


class FileLock:
    """Simple cross-platform advisory file lock.

    The lock is implemented using ``fcntl`` on POSIX platforms and ``msvcrt``
    on Windows.  A small polling loop is used to avoid blocking indefinitely
    when the lock is already held by another process.
    """

    def __init__(self, path: os.PathLike[str] | str) -> None:
        self.path = Path(path)
        self._fh: Optional[object] = None

    def acquire(
        self,
        *,
        timeout: Optional[float] = 30.0,
        poll_interval: float = 0.25,
    ) -> None:
        """Acquire the lock, waiting up to ``timeout`` seconds."""

        deadline = None if timeout is None else time.monotonic() + timeout
        self.path.parent.mkdir(parents=True, exist_ok=True)

        while True:
            try:
                self._fh = self.path.open("a+b")
                _lock_file(self._fh)
                self._fh.seek(0)
                self._fh.truncate()
                self._fh.write(str(os.getpid()).encode("utf-8"))
                self._fh.flush()
                os.fsync(self._fh.fileno())
                return
            except BlockingIOError:
                if deadline is not None and time.monotonic() > deadline:
                    raise FileLockTimeout(f"Timed out waiting for lock: {self.path}")
                time.sleep(poll_interval)

    def release(self) -> None:
        if self._fh is None:
            return
        try:
            _unlock_file(self._fh)
        except PermissionError:
            # Windows file locking may fail with PermissionError
            # This is non-critical as the lock will be released when file is closed
            pass
        finally:
            try:
                self._fh.close()
            finally:
                self._fh = None

    @contextmanager
    def context(
        self,
        *,
        timeout: Optional[float] = 30.0,
        poll_interval: float = 0.25,
    ) -> Iterator[None]:
        self.acquire(timeout=timeout, poll_interval=poll_interval)
        try:
            yield
        finally:
            self.release()


def _lock_file(fh: object) -> None:
    if os.name == "nt":
        _lock_windows(fh)
    else:
        _lock_posix(fh)


def _unlock_file(fh: object) -> None:
    if os.name == "nt":
        _unlock_windows(fh)
    else:
        _unlock_posix(fh)


if os.name == "nt":  # pragma: no cover - Windows only
    import msvcrt

    def _lock_windows(fh: object) -> None:
        try:
            msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError as exc:  # pragma: no cover - forwarded as BlockingIOError
            raise BlockingIOError(str(exc))

    def _unlock_windows(fh: object) -> None:
        msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)

else:  # POSIX
    import fcntl

    def _lock_posix(fh: object) -> None:
        fcntl.flock(fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)

    def _unlock_posix(fh: object) -> None:
        fcntl.flock(fh.fileno(), fcntl.LOCK_UN)


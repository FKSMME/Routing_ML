"""
Data models for Monitor Application
"""

from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass(frozen=True)
class Service:
    """Represents a single monitored endpoint"""
    key: str
    name: str
    icon: str
    check_url: str
    start_command: Optional[str] = None
    links: Tuple[Tuple[str, str], ...] = ()
    timeout: float = 3.0


SERVICES: Tuple[Service, ...] = (
    Service(
        key="backend",
        name="Backend API",
        icon="🔧",
        check_url="https://localhost:8000/api/health",
        start_command="run_backend_main.bat",
        links=(
            ("Local", "https://localhost:8000/docs"),
            ("Domain", "https://rtml.ksm.co.kr:8000/docs"),
        ),
    ),
    Service(
        key="home",
        name="Home",
        icon="🏠",
        check_url="https://localhost:5176/",
        start_command="run_frontend_home.bat",
        links=(
            ("Local", "https://localhost:5176"),
            ("Domain", "https://rtml.ksm.co.kr:5176"),
        ),
    ),
    Service(
        key="prediction",
        name="Routing",
        icon="🎯",
        check_url="https://localhost:5173/",
        start_command="run_frontend_prediction.bat",
        links=(
            ("Local", "https://localhost:5173"),
            ("Domain", "https://rtml.ksm.co.kr:5173"),
        ),
    ),
    Service(
        key="training",
        name="Training",
        icon="🧠",
        check_url="https://localhost:5174/",
        start_command="run_frontend_training.bat",
        links=(
            ("Local", "https://localhost:5174"),
            ("Domain", "https://rtml.ksm.co.kr:5174"),
        ),
    ),
)

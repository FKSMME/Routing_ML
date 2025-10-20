"""
Routing ML Monitor v6.0.0
Modularized version using monitor package
"""

from monitor.models import SERVICES
from monitor.ui.dashboard import RoutingMLDashboard


def main():
    """Main entry point for Monitor v6.0"""
    app = RoutingMLDashboard(SERVICES)
    app.run()


if __name__ == "__main__":
    main()

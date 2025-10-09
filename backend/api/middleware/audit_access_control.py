"""Audit log access control middleware."""
from __future__ import annotations

from functools import wraps
from typing import Callable

from fastapi import HTTPException, Request, status

from backend.api.services.auth_service import AuthService


AUDIT_LOG_ROLES = {"admin", "auditor", "security_admin"}


def require_audit_access(func: Callable) -> Callable:
    """Decorator to enforce audit log access control.

    Only users with admin, auditor, or security_admin roles can access audit endpoints.

    Args:
        func: FastAPI route handler function

    Returns:
        Wrapped function with access control

    Raises:
        HTTPException: 403 Forbidden if user lacks audit access

    Example:
        @router.get("/audit/logs")
        @require_audit_access
        async def get_audit_logs(request: Request):
            return {"logs": [...]}
    """

    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Extract request from args/kwargs
        request: Request | None = None
        for arg in args:
            if isinstance(arg, Request):
                request = arg
                break
        if not request:
            request = kwargs.get("request")

        if not request:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Request object not found in route handler",
            )

        # Get user from request state (set by auth middleware)
        user = getattr(request.state, "user", None)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to access audit logs",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Check user role
        user_role = getattr(user, "role", None) or user.get("role")

        if user_role not in AUDIT_LOG_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {', '.join(AUDIT_LOG_ROLES)}",
            )

        # User has access, proceed with route handler
        return await func(*args, **kwargs)

    return wrapper


def check_audit_access(user_role: str) -> bool:
    """Check if a user role has audit log access.

    Args:
        user_role: User's role (admin, auditor, user, etc.)

    Returns:
        True if user has audit access, False otherwise

    Example:
        if check_audit_access(user.role):
            # Show audit log link
        else:
            # Hide audit log link
    """
    return user_role in AUDIT_LOG_ROLES


def log_audit_access(
    username: str,
    action: str,
    resource: str,
    ip_address: str | None = None,
    result: str = "success",
) -> None:
    """Log audit log access attempts for security monitoring.

    Args:
        username: Username accessing audit logs
        action: Action performed (read, export, delete)
        resource: Audit resource accessed (logs, events, snapshots)
        ip_address: Client IP address
        result: Access result (success, denied)

    Example:
        log_audit_access(
            username="admin@example.com",
            action="read",
            resource="ui_events",
            ip_address="192.168.1.10",
            result="success"
        )
    """
    from common.logger import audit_routing_event

    audit_routing_event(
        action=f"audit.{action}",
        payload={
            "resource": resource,
            "result": result,
        },
        username=username,
        client_host=ip_address,
    )


__all__ = [
    "require_audit_access",
    "check_audit_access",
    "log_audit_access",
    "AUDIT_LOG_ROLES",
]

"""Unit tests for Role-Based Access Control (RBAC) authorization.

Tests admin vs user access patterns and verifies audit logging for 403 events.
"""
import logging
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException, Request, status
from fastapi.testclient import TestClient

from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_admin


class TestRequireAdminAuthorization:
    """Test suite for require_admin dependency with audit logging."""

    @pytest.fixture
    def admin_user(self):
        """Create a mock admin user."""
        user = MagicMock(spec=AuthenticatedUser)
        user.user_id = 1
        user.username = "admin_user"
        user.is_admin = True
        user.client_host = "192.168.1.100"
        return user

    @pytest.fixture
    def regular_user(self):
        """Create a mock regular (non-admin) user."""
        user = MagicMock(spec=AuthenticatedUser)
        user.user_id = 2
        user.username = "regular_user"
        user.is_admin = False
        user.client_host = "192.168.1.101"
        return user

    @pytest.fixture
    def mock_request(self):
        """Create a mock FastAPI Request object."""
        # Create properly configured mock without spec to avoid hasattr issues
        client_mock = MagicMock()
        client_mock.host = "192.168.1.101"

        url_mock = MagicMock()
        url_mock.path = "/api/admin/workflow/config"

        request = MagicMock()  # Removed spec=Request
        request.client = client_mock
        request.url = url_mock
        request.method = "GET"
        return request

    @pytest.mark.asyncio
    async def test_admin_user_access_granted(self, admin_user, mock_request):
        """Test that admin users are granted access."""
        # Act
        result = await require_admin(mock_request, admin_user)

        # Assert
        assert result == admin_user
        assert result.is_admin is True

    @pytest.mark.asyncio
    async def test_regular_user_access_denied(self, regular_user, mock_request, caplog):
        """Test that regular users are denied access and 403 is raised."""
        # Arrange
        caplog.set_level(logging.WARNING)

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(mock_request, regular_user)

        # Verify 403 status code
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "관리자 권한이 필요합니다" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_403_audit_logging_on_denied_access(
        self, regular_user, mock_request, caplog
    ):
        """Test that 403 events are logged with full audit details."""
        # Arrange
        caplog.set_level(logging.WARNING)

        # Act
        with pytest.raises(HTTPException):
            await require_admin(mock_request, regular_user)

        # Assert - verify audit log was created
        assert len(caplog.records) >= 1
        log_record = caplog.records[0]

        # Verify log level
        assert log_record.levelname == "WARNING"

        # Verify log message contains key info
        assert "Authorization denied" in log_record.message
        assert regular_user.username in log_record.message
        assert str(regular_user.user_id) in log_record.message

        # Verify structured logging extras
        assert "event" in log_record.__dict__
        assert log_record.event == "authorization_denied"
        assert log_record.user_id == regular_user.user_id
        assert log_record.username == regular_user.username
        assert log_record.requested_path == mock_request.url.path
        assert log_record.requested_method == mock_request.method
        assert log_record.client_ip == mock_request.client.host
        assert log_record.is_admin is False

    @pytest.mark.asyncio
    async def test_no_logging_on_successful_admin_access(
        self, admin_user, mock_request, caplog
    ):
        """Test that successful admin access does not generate warning logs."""
        # Arrange
        caplog.set_level(logging.WARNING)

        # Act
        await require_admin(mock_request, admin_user)

        # Assert - no warning logs should exist
        assert len(caplog.records) == 0

    @pytest.mark.asyncio
    async def test_403_logging_with_missing_request_data(self, regular_user, caplog):
        """Test that 403 logging handles missing request data gracefully."""
        # Arrange
        caplog.set_level(logging.WARNING)
        incomplete_request = MagicMock(spec=Request)
        incomplete_request.client = None  # Missing client
        incomplete_request.url = None  # Missing URL
        incomplete_request.method = None  # Missing method

        # Act
        with pytest.raises(HTTPException):
            await require_admin(incomplete_request, regular_user)

        # Assert - verify logging still works with "unknown" fallbacks
        assert len(caplog.records) >= 1
        log_record = caplog.records[0]
        assert "unknown" in log_record.message or log_record.client_ip == "unknown"


class TestAuthorizationIntegration:
    """Integration tests for admin-only endpoints."""

    @pytest.mark.asyncio
    async def test_workflow_endpoint_requires_admin(self):
        """Test that workflow endpoints enforce admin requirement.

        NOTE: This is a placeholder for future integration tests that would
        test actual API endpoints with TestClient and real auth tokens.
        """
        # This would use TestClient to test real endpoints
        # Example:
        # client = TestClient(app)
        # response = client.get("/api/workflow/config", headers={"Authorization": "Bearer <user_token>"})
        # assert response.status_code == 403
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

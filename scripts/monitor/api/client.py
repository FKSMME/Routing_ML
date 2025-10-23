"""
API client for communicating with Routing ML backend
"""

import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
import http.cookiejar as cookiejar
from typing import Dict, Optional

from monitor.api.errors import ApiError
from monitor.config import USER_AGENT, VERIFY_SSL


class ApiClient:
    """Simple API client with cookie support for the Routing ML backend."""

    def __init__(
        self,
        base_url: str,
        username: Optional[str],
        password: Optional[str],
        *,
        timeout: float = 8.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.timeout = timeout
        self.context = ssl.create_default_context()

        # Configure SSL verification based on environment variable
        if not VERIFY_SSL:
            # WARNING: SSL verification disabled - vulnerable to MITM attacks
            # Only use in development with self-signed certificates
            self.context.check_hostname = False
            self.context.verify_mode = ssl.CERT_NONE
        # else: use default secure settings (CERT_REQUIRED)

        self.cookie_jar = cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=self.context),
            urllib.request.HTTPCookieProcessor(self.cookie_jar),
        )
        self.headers = {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json",
        }
        if not self.username or not self.password:
            raise ApiError(
                "Admin API credentials are missing. Set MONITOR_ADMIN_USERNAME / MONITOR_ADMIN_PASSWORD."
            )
        self._authenticate()

    def _authenticate(self) -> None:
        payload = json.dumps(
            {"username": self.username, "password": self.password}
        ).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}/api/auth/login",
            data=payload,
            headers=self.headers,
            method="POST",
        )
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                if response.status != 200:
                    raise ApiError(f"Login failed (HTTP {response.status})")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise ApiError(f"Login failed: {exc.reason} ({exc.code}) {detail}") from exc
        except urllib.error.URLError as exc:
            raise ApiError(f"Unable to reach API server: {exc.reason}") from exc

    def _request(
        self,
        method: str,
        path: str,
        *,
        data: Optional[bytes] = None,
        params: Optional[Dict[str, Optional[str]]] = None,
    ) -> Optional[dict]:
        url = f"{self.base_url}{path}"
        if params:
            filtered = {k: v for k, v in params.items() if v not in (None, "")}
            if filtered:
                query = urllib.parse.urlencode(filtered)
                separator = "&" if "?" in url else "?"
                url = f"{url}{separator}{query}"

        request = urllib.request.Request(
            url,
            data=data,
            headers=self.headers,
            method=method.upper(),
        )
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                payload = response.read()
                if not payload:
                    return None
                try:
                    return json.loads(payload.decode("utf-8"))
                except json.JSONDecodeError:
                    return None
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise ApiError(
                f"API 요청 실패 (HTTP {exc.code}): {detail or exc.reason}"
            ) from exc
        except urllib.error.URLError as exc:
            raise ApiError(f"Unable to reach API server: {exc.reason}") from exc

    def get_json(
        self,
        path: str,
        *,
        params: Optional[Dict[str, Optional[str]]] = None,
    ) -> Optional[dict]:
        return self._request("GET", path, params=params)

    def post_json(self, path: str, payload: dict) -> Optional[dict]:
        data = json.dumps(payload).encode("utf-8")
        return self._request("POST", path, data=data)

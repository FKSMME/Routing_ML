"""이메일 알림 서비스 (MS365 Outlook 지원)."""
from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from backend.api.config import Settings, get_settings
from common.logger import get_logger


class EmailService:
    """이메일 발송 서비스"""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._logger = get_logger("email.service")

    def send_email(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
    ) -> bool:
        """
        이메일 발송

        Args:
            to_email: 수신자 이메일
            subject: 제목
            body_html: HTML 본문
            body_text: 텍스트 본문 (선택, 없으면 HTML 본문 사용)

        Returns:
            bool: 발송 성공 여부
        """
        if not self.settings.email_enabled:
            self._logger.info("이메일 알림이 비활성화되어 있습니다")
            return False

        if not self.settings.email_sender or not self.settings.email_password:
            self._logger.warning("이메일 발신자 정보가 설정되지 않았습니다")
            return False

        try:
            # 이메일 메시지 생성
            msg = MIMEMultipart("alternative")
            msg["From"] = self.settings.email_sender
            msg["To"] = to_email
            msg["Subject"] = subject

            # 텍스트 본문
            if body_text:
                part_text = MIMEText(body_text, "plain", "utf-8")
                msg.attach(part_text)

            # HTML 본문
            part_html = MIMEText(body_html, "html", "utf-8")
            msg.attach(part_html)

            # SMTP 서버 연결
            with smtplib.SMTP(
                self.settings.email_smtp_server,
                self.settings.email_smtp_port,
                timeout=10,
            ) as server:
                if self.settings.email_use_tls:
                    server.starttls()

                server.login(
                    self.settings.email_sender,
                    self.settings.email_password,
                )
                server.send_message(msg)

            self._logger.info(f"이메일 발송 성공: {to_email}")
            return True

        except Exception as exc:
            self._logger.error(f"이메일 발송 실패 ({to_email}): {exc}")
            return False

    def notify_admin_new_registration(self, username: str, full_name: str | None, email: str | None) -> bool:
        """관리자에게 신규 회원가입 알림"""
        if not self.settings.email_admin:
            self._logger.info("관리자 이메일이 설정되지 않아 알림을 보내지 않습니다")
            return False

        subject = f"[Routing ML] 신규 회원가입 승인 요청 - {username}"

        html_body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #00d4ff, #0088ff); color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
                .info-box {{ background: white; padding: 15px; border-left: 4px solid #00d4ff; margin: 20px 0; }}
                .info-label {{ font-weight: bold; color: #555; }}
                .info-value {{ color: #000; margin-left: 10px; }}
                .footer {{ text-align: center; padding: 20px; color: #777; font-size: 12px; }}
                .button {{ background: #00ff88; color: #000; padding: 12px 24px; text-decoration: none;
                           border-radius: 5px; display: inline-block; font-weight: bold; margin: 10px 5px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0;">◢ Routing ML v4.0 ◣</h1>
                    <p style="margin: 5px 0 0 0;">신규 회원가입 승인 요청</p>
                </div>
                <div class="content">
                    <h2>신규 사용자가 가입을 요청했습니다</h2>
                    <div class="info-box">
                        <p><span class="info-label">사용자명:</span><span class="info-value">{username}</span></p>
                        <p><span class="info-label">이름:</span><span class="info-value">{full_name or 'N/A'}</span></p>
                        <p><span class="info-label">이메일:</span><span class="info-value">{email or 'N/A'}</span></p>
                    </div>
                    <p>
                        <strong>Routing ML Service Monitor</strong>를 실행하여 회원 관리 탭에서 승인하거나 거절할 수 있습니다.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <p style="font-size: 14px; color: #666;">
                            Service Monitor를 열어 <strong>회원 관리</strong> 탭을 확인하세요.
                        </p>
                    </div>
                </div>
                <div class="footer">
                    <p>◢ Routing ML v4.0.0 Cyberpunk Edition ◣</p>
                    <p>이 메시지는 자동으로 발송되었습니다.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        ◢ Routing ML v4.0 ◣
        신규 회원가입 승인 요청

        신규 사용자가 가입을 요청했습니다.

        사용자명: {username}
        이름: {full_name or 'N/A'}
        이메일: {email or 'N/A'}

        Routing ML Service Monitor를 실행하여 회원 관리 탭에서 승인하거나 거절할 수 있습니다.

        ---
        ◢ Routing ML v4.0.0 Cyberpunk Edition ◣
        이 메시지는 자동으로 발송되었습니다.
        """

        return self.send_email(
            to_email=self.settings.email_admin,
            subject=subject,
            body_html=html_body,
            body_text=text_body,
        )

    def notify_user_approved(self, username: str, email: str, is_admin: bool = False) -> bool:
        """사용자에게 승인 완료 알림"""
        if not email:
            self._logger.info(f"사용자 {username}의 이메일 주소가 없어 알림을 보내지 않습니다")
            return False

        subject = "[Routing ML] 회원가입이 승인되었습니다"

        admin_notice = " (관리자 권한 부여)" if is_admin else ""

        html_body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #00ff88, #00ffaa); color: #000; padding: 20px; border-radius: 8px 8px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
                .success-box {{ background: #e8f5e9; padding: 20px; border-left: 4px solid #00ff88; margin: 20px 0; border-radius: 4px; }}
                .button {{ background: #00d4ff; color: #000; padding: 12px 24px; text-decoration: none;
                           border-radius: 5px; display: inline-block; font-weight: bold; margin: 10px 0; }}
                .footer {{ text-align: center; padding: 20px; color: #777; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0;">◢ Routing ML v4.0 ◣</h1>
                    <p style="margin: 5px 0 0 0;">회원가입 승인 완료</p>
                </div>
                <div class="content">
                    <div class="success-box">
                        <h2 style="margin-top: 0; color: #2e7d32;">✓ 승인 완료!</h2>
                        <p><strong>{username}</strong>님의 회원가입이 승인되었습니다{admin_notice}.</p>
                    </div>
                    <p>이제 Routing ML 시스템에 로그인할 수 있습니다.</p>
                    <h3>로그인 정보</h3>
                    <ul>
                        <li><strong>사용자명:</strong> {username}</li>
                        <li><strong>권한:</strong> {'관리자' if is_admin else '일반 사용자'}</li>
                    </ul>
                    <p>비밀번호는 회원가입 시 설정하신 비밀번호를 사용하시면 됩니다.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <p style="font-size: 14px; color: #666;">
                            로그인 후 모든 기능을 사용하실 수 있습니다.
                        </p>
                    </div>
                </div>
                <div class="footer">
                    <p>◢ Routing ML v4.0.0 Cyberpunk Edition ◣</p>
                    <p>이 메시지는 자동으로 발송되었습니다.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        ◢ Routing ML v4.0 ◣
        회원가입 승인 완료

        ✓ 승인 완료!

        {username}님의 회원가입이 승인되었습니다{admin_notice}.

        이제 Routing ML 시스템에 로그인할 수 있습니다.

        로그인 정보:
        - 사용자명: {username}
        - 권한: {'관리자' if is_admin else '일반 사용자'}

        비밀번호는 회원가입 시 설정하신 비밀번호를 사용하시면 됩니다.

        ---
        ◢ Routing ML v4.0.0 Cyberpunk Edition ◣
        이 메시지는 자동으로 발송되었습니다.
        """

        return self.send_email(
            to_email=email,
            subject=subject,
            body_html=html_body,
            body_text=text_body,
        )

    def notify_user_rejected(self, username: str, email: str, reason: str | None = None) -> bool:
        """사용자에게 거절 알림"""
        if not email:
            self._logger.info(f"사용자 {username}의 이메일 주소가 없어 알림을 보내지 않습니다")
            return False

        subject = "[Routing ML] 회원가입 요청이 거절되었습니다"

        reason_text = f"<p><strong>거절 사유:</strong> {reason}</p>" if reason else ""
        reason_text_plain = f"\n거절 사유: {reason}\n" if reason else ""

        html_body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #ff0055, #ff3377); color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
                .notice-box {{ background: #ffebee; padding: 20px; border-left: 4px solid #ff0055; margin: 20px 0; border-radius: 4px; }}
                .footer {{ text-align: center; padding: 20px; color: #777; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0;">◢ Routing ML v4.0 ◣</h1>
                    <p style="margin: 5px 0 0 0;">회원가입 요청 거절</p>
                </div>
                <div class="content">
                    <div class="notice-box">
                        <h2 style="margin-top: 0; color: #c62828;">회원가입 요청이 거절되었습니다</h2>
                        <p><strong>{username}</strong>님의 회원가입 요청이 거절되었습니다.</p>
                        {reason_text}
                    </div>
                    <p>문의사항이 있으시면 시스템 관리자에게 문의해 주시기 바랍니다.</p>
                </div>
                <div class="footer">
                    <p>◢ Routing ML v4.0.0 Cyberpunk Edition ◣</p>
                    <p>이 메시지는 자동으로 발송되었습니다.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        ◢ Routing ML v4.0 ◣
        회원가입 요청 거절

        {username}님의 회원가입 요청이 거절되었습니다.
        {reason_text_plain}
        문의사항이 있으시면 시스템 관리자에게 문의해 주시기 바랍니다.

        ---
        ◢ Routing ML v4.0.0 Cyberpunk Edition ◣
        이 메시지는 자동으로 발송되었습니다.
        """

        return self.send_email(
            to_email=email,
            subject=subject,
            body_html=html_body,
            body_text=text_body,
        )


# 싱글톤 인스턴스
email_service = EmailService()

__all__ = ["email_service", "EmailService"]

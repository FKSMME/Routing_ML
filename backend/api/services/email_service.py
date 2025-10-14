"""이메일 알림 서비스 (Outlook Desktop 활용)."""
from __future__ import annotations

from typing import Optional

from backend.api.config import Settings, get_settings
from common.logger import get_logger


class OutlookNotAvailableError(Exception):
    """Outlook이 실행되지 않았거나 사용할 수 없을 때 발생하는 예외"""
    pass


class EmailService:
    """Outlook Desktop을 활용한 이메일 발송 서비스"""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._logger = get_logger("email.service")
        self._outlook = None

    def _get_outlook(self):
        """Outlook Application 객체 가져오기"""
        if self._outlook is not None:
            return self._outlook

        try:
            import win32com.client
            self._outlook = win32com.client.Dispatch("Outlook.Application")
            self._logger.info("Outlook Desktop 연결 성공")
            return self._outlook
        except Exception as exc:
            self._logger.warning(f"Outlook Desktop 연결 실패: {exc}")
            raise OutlookNotAvailableError(
                "Outlook Desktop을 실행해 주세요. "
                "Outlook이 실행 중이어야 이메일을 발송할 수 있습니다."
            ) from exc

    def send_email(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
    ) -> bool:
        """
        Outlook을 통해 이메일 작성창 열기 (사용자가 직접 발송)

        Args:
            to_email: 수신자 이메일
            subject: 제목
            body_html: HTML 본문
            body_text: 텍스트 본문 (사용 안 함, HTML만 사용)

        Returns:
            bool: 이메일 작성창 열기 성공 여부
        """
        if not self.settings.email_enabled:
            self._logger.info("이메일 알림이 비활성화되어 있습니다")
            return False

        try:
            outlook = self._get_outlook()

            # 새 이메일 생성 (0 = olMailItem)
            mail = outlook.CreateItem(0)
            mail.To = to_email
            mail.Subject = subject
            mail.HTMLBody = body_html

            # 이메일 작성창 표시 (사용자가 확인 후 발송)
            mail.Display(False)

            self._logger.info(f"이메일 작성창 열기 성공: {to_email}")
            return True

        except OutlookNotAvailableError:
            # Outlook이 실행되지 않은 경우
            raise
        except Exception as exc:
            self._logger.error(f"이메일 작성 실패 ({to_email}): {exc}")
            return False

    def notify_admin_new_registration(
        self, username: str, full_name: str | None, email: str | None
    ) -> bool:
        """관리자에게 신규 회원가입 알림"""
        if not self.settings.email_admin:
            self._logger.info("관리자 이메일이 설정되지 않아 알림을 보내지 않습니다")
            return False

        subject = f"🚀 신규 사용자 등록 요청 - {username}"

        html_body = f"""
        <html>
        <head>
            <style>
                body {{
                    font-family: 'Consolas', 'Courier New', monospace;
                    background: #0a0e27;
                    color: #00ffff;
                    line-height: 1.8;
                }}
                .container {{
                    max-width: 650px;
                    margin: 30px auto;
                    border: 2px solid #00ffff;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #0a0e27, #1a1e37);
                    box-shadow: 0 0 30px rgba(0,255,255,0.3);
                }}
                .header {{
                    background: linear-gradient(135deg, #00ffff, #ff007f);
                    color: #000;
                    padding: 25px;
                    border-radius: 10px 10px 0 0;
                    text-align: center;
                    font-weight: bold;
                }}
                .content {{
                    padding: 30px;
                }}
                .info-box {{
                    background: rgba(0,255,255,0.1);
                    border-left: 4px solid #00ffff;
                    padding: 20px;
                    margin: 20px 0;
                    border-radius: 5px;
                }}
                .label {{
                    color: #ff007f;
                    font-weight: bold;
                    display: inline-block;
                    width: 100px;
                }}
                .value {{
                    color: #00ffff;
                    font-weight: bold;
                }}
                .footer {{
                    text-align: center;
                    padding: 20px;
                    color: #9d00ff;
                    font-size: 11px;
                    border-top: 1px solid #00ffff;
                }}
                .highlight {{
                    color: #00ff88;
                    font-weight: bold;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0; font-size: 24px;">◢ ROUTING ML v4.0 CYBERPUNK ◣</h1>
                    <p style="margin: 10px 0 0 0; font-size: 14px;">NEW USER REGISTRATION REQUEST</p>
                </div>
                <div class="content">
                    <h2 style="color: #00ffff; text-shadow: 0 0 10px #00ffff;">⚡ 신규 회원가입 요청</h2>

                    <div class="info-box">
                        <p><span class="label">👤 사용자명:</span> <span class="value">{username}</span></p>
                        <p><span class="label">📛 이름:</span> <span class="value">{full_name or 'N/A'}</span></p>
                        <p><span class="label">📧 이메일:</span> <span class="value">{email or 'N/A'}</span></p>
                    </div>

                    <p style="color: #ffffff; margin: 25px 0;">
                        <span class="highlight">⚙️ Routing ML Service Monitor</span>를 실행하여
                        <span class="highlight">회원 관리</span> 탭에서 승인하거나 거절할 수 있습니다.
                    </p>

                    <p style="color: #ff007f; font-size: 13px; margin-top: 30px;">
                        ⚠️ 이 이메일은 Outlook Desktop을 통해 작성되었습니다.<br>
                        내용을 확인한 후 <strong>발송 버튼</strong>을 눌러 전송하세요.
                    </p>
                </div>
                <div class="footer">
                    <p>◢ ROUTING ML v4.0.0 CYBERPUNK EDITION ◣</p>
                    <p>AUTOMATED NOTIFICATION SYSTEM</p>
                </div>
            </div>
        </body>
        </html>
        """

        try:
            return self.send_email(
                to_email=self.settings.email_admin,
                subject=subject,
                body_html=html_body,
            )
        except OutlookNotAvailableError as exc:
            self._logger.warning(f"Outlook이 실행되지 않아 알림을 보낼 수 없습니다: {exc}")
            # 예외를 다시 발생시켜 호출자가 처리하도록 함
            raise

    def notify_user_approved(
        self, username: str, email: str, full_name: Optional[str] = None
    ) -> bool:
        """사용자에게 승인 완료 알림"""
        if not email:
            self._logger.info(f"사용자 {username}의 이메일 주소가 없어 알림을 보내지 않습니다")
            return False

        subject = f"✅ 회원가입 승인 완료 - {username}"

        html_body = f"""
        <html>
        <head>
            <style>
                body {{
                    font-family: 'Consolas', 'Courier New', monospace;
                    background: #0a0e27;
                    color: #00ff88;
                    line-height: 1.8;
                }}
                .container {{
                    max-width: 650px;
                    margin: 30px auto;
                    border: 2px solid #00ff88;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #0a0e27, #1a2e1a);
                    box-shadow: 0 0 30px rgba(0,255,136,0.3);
                }}
                .header {{
                    background: linear-gradient(135deg, #00ff88, #00ffaa);
                    color: #000;
                    padding: 25px;
                    border-radius: 10px 10px 0 0;
                    text-align: center;
                    font-weight: bold;
                }}
                .content {{
                    padding: 30px;
                }}
                .success-box {{
                    background: rgba(0,255,136,0.15);
                    border-left: 4px solid #00ff88;
                    padding: 25px;
                    margin: 20px 0;
                    border-radius: 5px;
                }}
                .footer {{
                    text-align: center;
                    padding: 20px;
                    color: #9d00ff;
                    font-size: 11px;
                    border-top: 1px solid #00ff88;
                }}
                .highlight {{
                    color: #00ffff;
                    font-weight: bold;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0; font-size: 24px;">◢ ROUTING ML v4.0 CYBERPUNK ◣</h1>
                    <p style="margin: 10px 0 0 0; font-size: 14px;">REGISTRATION APPROVED</p>
                </div>
                <div class="content">
                    <div class="success-box">
                        <h2 style="margin-top: 0; color: #00ff88; text-shadow: 0 0 10px #00ff88;">
                            ✓ 승인 완료!
                        </h2>
                        <p style="color: #ffffff; font-size: 16px;">
                            <strong style="color: #00ffff;">{full_name or username}</strong>님의
                            회원가입이 승인되었습니다.
                        </p>
                    </div>

                    <p style="color: #ffffff; margin: 25px 0;">
                        이제 <span class="highlight">Routing ML 시스템</span>에 로그인할 수 있습니다.
                    </p>

                    <h3 style="color: #00ffff;">🔑 로그인 정보</h3>
                    <ul style="color: #ffffff; line-height: 2;">
                        <li><strong style="color: #ff007f;">사용자명:</strong> {username}</li>
                        <li><strong style="color: #ff007f;">비밀번호:</strong> 회원가입 시 설정한 비밀번호</li>
                    </ul>

                    <p style="color: #00ff88; font-size: 14px; margin-top: 30px;">
                        💡 로그인 후 모든 기능을 사용하실 수 있습니다.
                    </p>

                    <p style="color: #ff007f; font-size: 13px; margin-top: 30px;">
                        ⚠️ 이 이메일은 Outlook Desktop을 통해 작성되었습니다.<br>
                        내용을 확인한 후 <strong>발송 버튼</strong>을 눌러 전송하세요.
                    </p>
                </div>
                <div class="footer">
                    <p>◢ ROUTING ML v4.0.0 CYBERPUNK EDITION ◣</p>
                    <p>AUTOMATED NOTIFICATION SYSTEM</p>
                </div>
            </div>
        </body>
        </html>
        """

        try:
            return self.send_email(
                to_email=email,
                subject=subject,
                body_html=html_body,
            )
        except OutlookNotAvailableError as exc:
            self._logger.warning(f"Outlook이 실행되지 않아 알림을 보낼 수 없습니다: {exc}")
            raise

    def notify_user_rejected(
        self, username: str, email: str, full_name: Optional[str] = None, reason: str | None = None
    ) -> bool:
        """사용자에게 거절 알림"""
        if not email:
            self._logger.info(f"사용자 {username}의 이메일 주소가 없어 알림을 보내지 않습니다")
            return False

        subject = f"❌ 회원가입 거절 알림 - {username}"

        reason_html = f"<p style='color: #ffffff;'><strong style='color: #ff007f;'>거절 사유:</strong> {reason}</p>" if reason else ""

        html_body = f"""
        <html>
        <head>
            <style>
                body {{
                    font-family: 'Consolas', 'Courier New', monospace;
                    background: #0a0e27;
                    color: #ff007f;
                    line-height: 1.8;
                }}
                .container {{
                    max-width: 650px;
                    margin: 30px auto;
                    border: 2px solid #ff007f;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #0a0e27, #2e1a1a);
                    box-shadow: 0 0 30px rgba(255,0,127,0.3);
                }}
                .header {{
                    background: linear-gradient(135deg, #ff007f, #ff3377);
                    color: #fff;
                    padding: 25px;
                    border-radius: 10px 10px 0 0;
                    text-align: center;
                    font-weight: bold;
                }}
                .content {{
                    padding: 30px;
                }}
                .notice-box {{
                    background: rgba(255,0,127,0.15);
                    border-left: 4px solid #ff007f;
                    padding: 25px;
                    margin: 20px 0;
                    border-radius: 5px;
                }}
                .footer {{
                    text-align: center;
                    padding: 20px;
                    color: #9d00ff;
                    font-size: 11px;
                    border-top: 1px solid #ff007f;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0; font-size: 24px;">◢ ROUTING ML v4.0 CYBERPUNK ◣</h1>
                    <p style="margin: 10px 0 0 0; font-size: 14px;">REGISTRATION REJECTED</p>
                </div>
                <div class="content">
                    <div class="notice-box">
                        <h2 style="margin-top: 0; color: #ff007f; text-shadow: 0 0 10px #ff007f;">
                            회원가입 요청이 거절되었습니다
                        </h2>
                        <p style="color: #ffffff; font-size: 16px;">
                            <strong style="color: #00ffff;">{full_name or username}</strong>님의
                            회원가입 요청이 거절되었습니다.
                        </p>
                        {reason_html}
                    </div>

                    <p style="color: #ffffff; margin: 25px 0;">
                        문의사항이 있으시면 시스템 관리자에게 연락해 주시기 바랍니다.
                    </p>

                    <p style="color: #00ffff; font-size: 14px; margin-top: 30px;">
                        📧 관리자: {self.settings.email_admin or 'syyun@ksm.co.kr'}
                    </p>

                    <p style="color: #ff007f; font-size: 13px; margin-top: 30px;">
                        ⚠️ 이 이메일은 Outlook Desktop을 통해 작성되었습니다.<br>
                        내용을 확인한 후 <strong>발송 버튼</strong>을 눌러 전송하세요.
                    </p>
                </div>
                <div class="footer">
                    <p>◢ ROUTING ML v4.0.0 CYBERPUNK EDITION ◣</p>
                    <p>AUTOMATED NOTIFICATION SYSTEM</p>
                </div>
            </div>
        </body>
        </html>
        """

        try:
            return self.send_email(
                to_email=email,
                subject=subject,
                body_html=html_body,
            )
        except OutlookNotAvailableError as exc:
            self._logger.warning(f"Outlook이 실행되지 않아 알림을 보낼 수 없습니다: {exc}")
            raise


# 싱글톤 인스턴스
email_service = EmailService()

__all__ = ["email_service", "EmailService", "OutlookNotAvailableError"]

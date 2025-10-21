#!/usr/bin/env python3
"""
사용자 승인 관리 스크립트
"""
import sys
from datetime import datetime
from typing import List, Tuple

from sqlalchemy import delete, select, update

from backend.api.config import get_settings
from backend.database_rsl import UserAccount, bootstrap_schema, session_scope


def _format_timestamp(value) -> str:
    if isinstance(value, datetime):
        return value.isoformat(sep=" ", timespec="seconds")
    return str(value)

def list_pending_users():
    """대기 중인 사용자 목록 표시"""
    with session_scope() as session:
        rows: List[Tuple[str, str, datetime]] = session.execute(
            select(UserAccount.username, UserAccount.display_name, UserAccount.created_at)
            .where(UserAccount.status == "pending")
            .order_by(UserAccount.created_at.desc())
        ).all()

    if not rows:
        print("✅ 승인 대기 중인 사용자가 없습니다.")
        return []

    print("\n📋 승인 대기 중인 사용자:")
    print("-" * 60)
    for i, (username, display_name, created_at) in enumerate(rows, 1):
        print(f"{i}. {username} ({display_name or '-'}) - 가입: {_format_timestamp(created_at)}")
    print("-" * 60)

    return rows

def list_all_users():
    """모든 사용자 목록 표시"""
    with session_scope() as session:
        rows: List[Tuple[str, str, str, bool, datetime]] = session.execute(
            select(
                UserAccount.username,
                UserAccount.display_name,
                UserAccount.status,
                UserAccount.is_admin,
                UserAccount.created_at,
            ).order_by(UserAccount.created_at.desc())
        ).all()

    print("\n👥 전체 사용자 목록:")
    print("-" * 80)
    print(f"{'사용자명':<30} {'이름':<15} {'상태':<10} {'관리자':<8} 가입일")
    print("-" * 80)

    for username, display_name, status, is_admin, created_at in rows:
        admin_badge = "✓" if is_admin else ""
        status_emoji = "✅" if status == "approved" else "⏳" if status == "pending" else "❌"
        print(
            f"{username:<30} {display_name or '-':<15} {status_emoji} {status:<8} "
            f"{admin_badge:<8} {_format_timestamp(created_at)}"
        )

    print("-" * 80)

def approve_user(username, make_admin=False):
    """사용자 승인"""
    with session_scope() as session:
        user = session.execute(
            select(UserAccount).where(UserAccount.username == username)
        ).scalar_one_or_none()

    if not user:
        print(f"❌ 사용자 '{username}'을 찾을 수 없습니다.")
        return False

    if user.status == "approved":
        print(f"⚠️  사용자 '{username}'은 이미 승인되었습니다.")
        return False

    # 승인 처리
    now = datetime.utcnow()
    with session_scope() as session:
        session.execute(
            update(UserAccount)
            .where(UserAccount.username == username)
            .values(
                status="approved",
                is_admin=bool(make_admin),
                approved_at=now,
                updated_at=now,
            )
        )

    admin_text = " (관리자 권한 부여)" if make_admin else ""
    print(f"✅ 사용자 '{username}'이 승인되었습니다{admin_text}")
    return True

def reject_user(username, reason=""):
    """사용자 거부"""
    with session_scope() as session:
        user = session.execute(
            select(UserAccount.username).where(UserAccount.username == username)
        ).scalar_one_or_none()

    if not user:
        print(f"❌ 사용자 '{username}'을 찾을 수 없습니다.")
        return False

    now = datetime.utcnow()
    with session_scope() as session:
        session.execute(
            update(UserAccount)
            .where(UserAccount.username == username)
            .values(status="rejected", rejected_at=now, updated_at=now)
        )

    print(f"❌ 사용자 '{username}'이 거부되었습니다.")
    if reason:
        print(f"   사유: {reason}")
    return True

def delete_user(username):
    """사용자 삭제"""
    with session_scope() as session:
        result = session.execute(
            delete(UserAccount).where(UserAccount.username == username)
        )
        deleted = result.rowcount or 0

    if deleted == 0:
        print(f"❌ 사용자 '{username}'을 찾을 수 없습니다.")
        return False

    print(f"🗑️  사용자 '{username}'이 삭제되었습니다.")
    return True

def main():
    get_settings()  # ensure environment variables are loaded
    bootstrap_schema()

    if len(sys.argv) < 2:
        print("""
🔧 사용자 관리 도구

사용법:
  python approve_user.py list              # 승인 대기 중인 사용자 목록
  python approve_user.py all               # 전체 사용자 목록
  python approve_user.py approve <사용자명> [--admin]  # 사용자 승인
  python approve_user.py reject <사용자명> [사유]      # 사용자 거부
  python approve_user.py delete <사용자명>  # 사용자 삭제

환경 변수:
  RSL_DATABASE_URL   PostgreSQL 연결 문자열 (예: postgresql+psycopg://user:pass@host:5432/routing_ml)

예시:
  python approve_user.py list
  python approve_user.py approve test@example.com
  python approve_user.py approve admin@example.com --admin
  python approve_user.py reject spam@example.com "스팸 계정"
        """)
        return

    command = sys.argv[1].lower()

    if command == "list":
        list_pending_users()

    elif command == "all":
        list_all_users()

    elif command == "approve":
        if len(sys.argv) < 3:
            print("❌ 사용자명을 입력하세요.")
            print("   예: python approve_user.py approve test@example.com")
            return

        username = sys.argv[2]
        make_admin = "--admin" in sys.argv
        approve_user(username, make_admin)

    elif command == "reject":
        if len(sys.argv) < 3:
            print("❌ 사용자명을 입력하세요.")
            print("   예: python approve_user.py reject test@example.com")
            return

        username = sys.argv[2]
        reason = " ".join(sys.argv[3:]) if len(sys.argv) > 3 else ""
        reject_user(username, reason)

    elif command == "delete":
        if len(sys.argv) < 3:
            print("❌ 사용자명을 입력하세요.")
            print("   예: python approve_user.py delete test@example.com")
            return

        username = sys.argv[2]
        delete_user(username)

    else:
        print(f"❌ 알 수 없는 명령어: {command}")
        print("   'list', 'all', 'approve', 'reject', 'delete' 중 하나를 사용하세요.")

if __name__ == "__main__":
    main()

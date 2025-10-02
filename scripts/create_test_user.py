"""테스트용 사용자 생성 스크립트."""
import sys
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.api.services.auth_service import auth_service
from backend.api.schemas import RegisterRequest

def create_test_user():
    """테스트용 admin 사용자 생성."""

    # 테스트 사용자 정보
    username = "admin"
    password = "admin123"
    display_name = "관리자"

    print(f"\n테스트 사용자 생성 중...")
    print(f"Username: {username}")
    print(f"Password: {password}")
    print(f"Display Name: {display_name}\n")

    try:
        # 사용자 등록
        request = RegisterRequest(
            username=username,
            password=password,
            display_name=display_name,
        )

        response = auth_service.register(request)
        print(f"✓ 사용자 등록 완료")
        print(f"  Status: {response.status}")
        print(f"  Message: {response.message}\n")

        # 사용자 승인 및 관리자 권한 부여
        if response.status == "pending":
            print(f"사용자 승인 중...")
            approved = auth_service.approve_user(username, make_admin=True)
            print(f"✓ 사용자 승인 완료")
            print(f"  Status: {approved.status}")
            print(f"  Is Admin: {approved.is_admin}\n")

        print("=" * 60)
        print("테스트 사용자 생성 완료!")
        print("=" * 60)
        print(f"\n로그인 정보:")
        print(f"  Username: {username}")
        print(f"  Password: {password}")
        print(f"\n브라우저에서 http://localhost:5176 접속하여 로그인하세요.\n")

    except ValueError as e:
        if "이미 존재합니다" in str(e):
            print(f"⚠ 사용자가 이미 존재합니다: {username}")
            print(f"\n로그인 정보:")
            print(f"  Username: {username}")
            print(f"  Password: {password}")
            print(f"\n기존 사용자로 로그인하세요.\n")
        else:
            print(f"✗ 오류 발생: {e}")
            sys.exit(1)
    except Exception as e:
        print(f"✗ 예상치 못한 오류: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    create_test_user()

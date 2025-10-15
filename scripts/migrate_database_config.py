#!/usr/bin/env python3
"""
MSSQL 데이터베이스 설정 마이그레이션 스크립트

.env 파일 또는 환경변수의 MSSQL 설정을 workflow_settings.json으로 이전합니다.

작성일: 2025-10-15
"""

import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional


def load_env_file(env_path: Path) -> Dict[str, str]:
    """
    .env 파일을 읽어서 딕셔너리로 반환합니다.

    Args:
        env_path: .env 파일 경로

    Returns:
        환경변수 딕셔너리
    """
    env_vars = {}
    if not env_path.exists():
        print(f"⚠️  .env 파일을 찾을 수 없습니다: {env_path}")
        return env_vars

    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            # 주석과 빈 줄 무시
            if not line or line.startswith("#"):
                continue
            # KEY=VALUE 파싱
            if "=" in line:
                key, value = line.split("=", 1)
                env_vars[key.strip()] = value.strip()

    return env_vars


def get_mssql_config_from_env(env_vars: Dict[str, str]) -> Dict[str, Any]:
    """
    환경변수에서 MSSQL 설정을 추출합니다.

    Args:
        env_vars: 환경변수 딕셔너리 (파일 또는 os.environ)

    Returns:
        MSSQL 설정 딕셔너리
    """
    # 기본값 (backend/database.py 참조)
    defaults = {
        "mssql_server": "K3-DB.ksm.co.kr,1433",
        "mssql_database": "KsmErp",
        "mssql_user": "FKSM_BI",
        "mssql_password": "",
        "mssql_encrypt": False,
        "mssql_trust_certificate": True,
        "mssql_item_view": "dbo.BI_ITEM_INFO_VIEW",
        "mssql_routing_view": "dbo.BI_ROUTING_HIS_VIEW",
        "mssql_work_result_view": "dbo.BI_WORK_ORDER_RESULTS",
        "mssql_purchase_order_view": "dbo.BI_PUR_PO_VIEW",
    }

    # 환경변수에서 값 읽기 (우선순위: env_vars > os.environ > defaults)
    config = {}
    mappings = {
        "MSSQL_SERVER": "mssql_server",
        "MSSQL_DATABASE": "mssql_database",
        "MSSQL_USER": "mssql_user",
        "MSSQL_PASSWORD": "mssql_password",
        "MSSQL_ENCRYPT": "mssql_encrypt",
        "MSSQL_TRUST_CERTIFICATE": "mssql_trust_certificate",
        "MSSQL_ITEM_VIEW": "mssql_item_view",
        "MSSQL_ROUTING_VIEW": "mssql_routing_view",
        "MSSQL_WORK_RESULT_VIEW": "mssql_work_result_view",
        "MSSQL_PURCHASE_ORDER_VIEW": "mssql_purchase_order_view",
    }

    for env_key, config_key in mappings.items():
        # .env 파일 우선
        value = env_vars.get(env_key)
        if value is None:
            # 시스템 환경변수 확인
            value = os.getenv(env_key)
        if value is None:
            # 기본값 사용
            value = defaults[config_key]

        # 타입 변환
        if config_key in ("mssql_encrypt", "mssql_trust_certificate"):
            if isinstance(value, str):
                config[config_key] = value.lower() in ("true", "yes", "1")
            else:
                config[config_key] = bool(value)
        else:
            config[config_key] = str(value)

    return config


def backup_workflow_settings(settings_path: Path) -> Optional[Path]:
    """
    workflow_settings.json 백업을 생성합니다.

    Args:
        settings_path: workflow_settings.json 경로

    Returns:
        백업 파일 경로 (생성 실패 시 None)
    """
    if not settings_path.exists():
        print(f"⚠️  워크플로우 설정 파일을 찾을 수 없습니다: {settings_path}")
        return None

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = settings_path.parent / f"workflow_settings.backup_{timestamp}.json"

    try:
        shutil.copy2(settings_path, backup_path)
        print(f"✅ 백업 생성: {backup_path}")
        return backup_path
    except Exception as e:
        print(f"❌ 백업 실패: {e}")
        return None


def migrate_mssql_config(
    settings_path: Path,
    mssql_config: Dict[str, Any],
    dry_run: bool = False,
) -> bool:
    """
    MSSQL 설정을 workflow_settings.json에 병합합니다.

    Args:
        settings_path: workflow_settings.json 경로
        mssql_config: MSSQL 설정 딕셔너리
        dry_run: True일 경우 실제 저장하지 않고 미리보기만 수행

    Returns:
        성공 여부
    """
    # 기존 설정 로드
    if settings_path.exists():
        with open(settings_path, "r", encoding="utf-8") as f:
            settings = json.load(f)
    else:
        print(f"⚠️  워크플로우 설정 파일이 없습니다. 새로 생성합니다: {settings_path}")
        settings = {}

    # data_source 섹션 가져오기 (없으면 생성)
    data_source = settings.get("data_source", {})

    # MSSQL 설정 병합
    data_source.update(mssql_config)

    # 버전 힌트 업데이트
    data_source["version_hint"] = "datasource-config-v3-mssql"

    # 설정에 다시 저장
    settings["data_source"] = data_source
    settings["updated_at"] = datetime.utcnow().isoformat()

    # 미리보기
    print("\n" + "=" * 60)
    print("📝 병합된 data_source 설정:")
    print("=" * 60)
    print(json.dumps(data_source, indent=2, ensure_ascii=False))
    print("=" * 60)

    if dry_run:
        print("\n🔍 [DRY RUN] 실제 저장하지 않습니다.")
        return True

    # 실제 저장
    try:
        with open(settings_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2, ensure_ascii=False)
        print(f"\n✅ 설정 저장 완료: {settings_path}")
        return True
    except Exception as e:
        print(f"\n❌ 설정 저장 실패: {e}")
        return False


def main():
    """메인 실행 함수"""
    print("=" * 60)
    print("📦 MSSQL 데이터베이스 설정 마이그레이션")
    print("=" * 60)
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    # 프로젝트 루트 디렉터리
    project_root = Path(__file__).resolve().parents[1]
    env_path = project_root / ".env"
    settings_path = project_root / "config" / "workflow_settings.json"

    # 1. .env 파일 로드
    print("1️⃣  .env 파일 로드 중...")
    env_vars = load_env_file(env_path)
    if env_vars:
        print(f"   ✅ {len(env_vars)}개 환경변수 로드")
    else:
        print("   ⚠️  .env 파일이 없거나 비어있습니다. 시스템 환경변수를 사용합니다.")

    # 2. MSSQL 설정 추출
    print("\n2️⃣  MSSQL 설정 추출 중...")
    mssql_config = get_mssql_config_from_env(env_vars)
    print("   ✅ MSSQL 설정 추출 완료")
    print(f"      - Server: {mssql_config['mssql_server']}")
    print(f"      - Database: {mssql_config['mssql_database']}")
    print(f"      - User: {mssql_config['mssql_user']}")
    print(f"      - Password: {'****' if mssql_config['mssql_password'] else '(empty)'}")

    # 3. 백업 생성
    print("\n3️⃣  workflow_settings.json 백업 생성 중...")
    backup_path = backup_workflow_settings(settings_path)
    if not backup_path and settings_path.exists():
        print("   ⚠️  백업 생성 실패. 계속 진행하시겠습니까? (y/N)")
        response = input("   > ").strip().lower()
        if response != "y":
            print("   ❌ 마이그레이션 중단")
            return

    # 4. 마이그레이션 (먼저 dry-run)
    print("\n4️⃣  마이그레이션 미리보기 (Dry Run)...")
    migrate_mssql_config(settings_path, mssql_config, dry_run=True)

    # 5. 사용자 확인
    print("\n위 설정으로 진행하시겠습니까? (y/N)")
    response = input("> ").strip().lower()
    if response != "y":
        print("\n❌ 마이그레이션 취소")
        return

    # 6. 실제 마이그레이션
    print("\n5️⃣  실제 마이그레이션 실행 중...")
    success = migrate_mssql_config(settings_path, mssql_config, dry_run=False)

    # 7. 완료
    if success:
        print("\n" + "=" * 60)
        print("✅ 마이그레이션 완료!")
        print("=" * 60)
        print(f"완료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("\n📌 다음 단계:")
        print("   1. 애플리케이션을 재시작하세요.")
        print("   2. Database Settings UI에서 설정을 확인하세요.")
        print("   3. 연결 테스트를 수행하세요.")
        if backup_path:
            print(f"\n🗂️  백업 파일: {backup_path}")
    else:
        print("\n❌ 마이그레이션 실패")


if __name__ == "__main__":
    main()

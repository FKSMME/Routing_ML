# Database Runtime Config - Test Execution Log

- **작성일:** 2025-10-15
- **작성자:** Codex

## 1. 환경 정보
- 가상환경: `.venv` (Windows, Python 3.12.6)
- 목적: `tests/backend/api/test_database_config.py` 신규 테스트 실행을 위한 의존성 정비 및 검증

## 2. 실행 명령 & 결과

| 순서 | 실행 명령 | 결과 | 비고 |
|------|-----------|------|------|
| 1 | `.venv\Scripts\python -m pip install pytest` | ⛔ 실패<br/>`Could not find a suitable TLS CA certificate bundle, invalid path: C:\Users\syyun\Documents\GitHub\MCS\certs\corp-chain.pem` | 디폴트 CA 경로 잘못 지정 |
| 2 | `$env:PIP_CERT`, `REQUESTS_CA_BUNDLE`, `SSL_CERT_FILE`를 `certs\ca-bundle.pem`으로 지정 후 `pip install pytest` | ✅ 성공 | 사내 인증서 번들(`certs\ca-bundle.pem`) 사용 |
| 3 | 동일 방식으로 `pip install pydantic==2.8.2 pydantic-settings==2.3.4` | ✅ 성공 | 라우터 종속성 해결 |
| 4 | `numpy`, `pandas` 재설치 (`--force-reinstall --no-cache-dir`) | ✅ 성공 | C-extension 로딩 오류 해결 |
| 5 | `python -m pytest tests/backend/api/test_database_config.py` | ✅ PASS (경고 다수) | pyodbc/argon2/security 모듈 스텁 주입 |

## 3. 수행 메모
- CA 경로 문제는 레포 내 `certs/ca-bundle.pem`을 직접 지정해 해결
- `pyodbc`, `argon2`, `backend.api.security` 등 외부 의존성은 테스트 스텁으로 대체
- `numpy`, `pandas`는 wheel 손상으로 인한 오류가 있어 강제 재설치
- Pydantic v1 스타일 validator, `datetime.utcnow()` 등에서 경고 발생 (추후 리팩터 필요)

## 4. 후속 권장 사항
1. **환경 변수 정비**: 시스템 레벨 `REQUESTS_CA_BUNDLE`, `SSL_CERT_FILE` 등도 사내 표준 경로로 유지
2. **경고 처리**: Pydantic v2 마이그레이션, UTC 처리 방식 교체 등 기술 부채 해소
3. **의존성 관리**: 전체 테스트 실행 시에는 pyodbc/argon2/cryptography 등 실 모듈 설치 여부 검토

## 5. 최종 상태
- `pytest` 및 테스트에 필요한 Python 패키지 설치 완료
- `tests/backend/api/test_database_config.py` 3건 PASS 확인
- 경고는 기능 영향이 없어 향후 리팩터 시 반영 예정

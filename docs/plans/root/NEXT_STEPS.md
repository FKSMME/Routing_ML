# 다음 단계 작업 항목

## 완료된 작업 (2025-10-08)
- ✅ Phase 5: 번들 최적화 검증 (38% 감소)
- ✅ Phase 6: 알고리즘 시각화 워크스페이스
  - Frontend: React Flow 기반 노드 에디터
  - Backend: Python AST 파서
  - Features: Dagre 레이아웃, 드래그앤드롭, localStorage

## 현재 상태
- Frontend dev 서버: Port 5173, 5174 실행 중
- Backend 서버: 미실행 (uvicorn 미설치)
- Git: 1 commit ahead

## 다음 우선순위 작업

### 1. Backend 서버 실행 환경 구축
- [ ] Python 가상환경 설정
- [ ] uvicorn, fastapi 설치
- [ ] 백엔드 서버 실행 (port 8000)
- [ ] 알고리즘 시각화 API E2E 테스트

### 2. 알고리즘 시각화 완성도 향상
- [ ] 실제 Python 파일로 테스트 (backend/trainer_ml.py 등)
- [ ] 소스 코드 뷰어 추가 (다이얼로그 내)
- [ ] 에러 핸들링 개선
- [ ] 성능 최적화 (100+ 노드 대응)

### 3. E2E 테스트 환경 구축
- [ ] Playwright 브라우저 설치
- [ ] 알고리즘 시각화 E2E 테스트 작성
- [ ] CI/CD 파이프라인 통합

### 4. 문서화
- [ ] API 문서 (Swagger UI)
- [ ] 사용자 가이드
- [ ] 개발자 가이드

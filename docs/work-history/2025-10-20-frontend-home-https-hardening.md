# Frontend-Home HTTPS Hardening (2025-10-20 18:30~19:00 KST)

## 완료된 작업
- `frontend-home/server.js`  
  - 인증서가 없을 때 HTTP로 강제 다운그레이드하지 않고 즉시 실패하도록 변경.  
  - HTTPS 기동 시 포트 충돌(EADDRINUSE) 메시지를 명확하게 출력.  
  - 옵션 환경 변수 `HTTP_REDIRECT_PORT`를 이용한 HTTP→HTTPS 301 리디렉션 서버 추가.
- 정적 자원  
  - `index.html`, `dashboard.html`, `view-explorer.html`에서 `API_BASE`를 상대 경로(`/api/...`) 기반으로 정리하여 프로토콜을 자동 추종하도록 변경.
- 배치 스크립트  
  - `run_frontend_home.bat`에서 인증서 존재 여부를 실행 전에 검사하고, HTTPS/리디렉션 관련 환경 변수를 한 곳에서 설정하도록 정비.

## 검증
- 코드 정적 점검(로컬).  
  *정식 HTTPS 기동 및 브라우저 검증은 운영 환경에서 인증서로 확인 필요.*

## TODO / 참고
- 실제 배포 시 `SSL_CERT_PATH`, `SSL_KEY_PATH`, `HTTP_REDIRECT_PORT`를 환경에 맞춰 조정.  
- API 백엔드 주소가 변경되는 경우 `API_TARGET` 환경 변수로 프록시 대상을 맞춰야 함.


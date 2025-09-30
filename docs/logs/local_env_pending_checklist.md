# 로컬 환경 필요 체크리스트 현황 (2025-10-05 기준)

## 개요
- 미완료 체크 항목 38건 중 문서 편집만으로 해결 가능한 3건(🚫 제외: `task_details/step1_routing_enhancement_plan.md` 2건, `task_details/menu1_master_data_detail.md` 1건)을 제외하고, 로컬/현장 장비가 필요한 35건을 아래에 집계했습니다.
- 기준: 실기 Windows PC, Lab-3 물리 장비, 보조공학 도구, 또는 승인 프로세스 로그 확보가 필수인 항목.
- 참고: `.github` 템플릿 항목은 실제 이슈/PR 작성 시 오프라인 승인·검증 로그가 있어야 체크 가능하므로 로컬 환경 의존 항목으로 분류했습니다.

## 세부 목록
### A. 이슈 템플릿 절대 지령 게이트 (9건)
| # | 문서 | 라인 | 체크 항목 | 로컬 필요 사유 |
| - | - | - | - | - |
| 1 | `.github/ISSUE_TEMPLATE.md` | L7 | 각 단계 승인 일정 확인 | 실제 승인 일정·로그는 사내 시스템에서만 확인 가능 |
| 2 | `.github/ISSUE_TEMPLATE.md` | L8 | 단계 착수 전 범위 리뷰 완료 | 온·오프라인 리뷰 증빙 확보 필요 |
| 3 | `.github/ISSUE_TEMPLATE.md` | L9 | 오류 발견 시 재승인 프로세스 명시 | 사내 승인 도구 기록 필요 |
| 4 | `.github/ISSUE_TEMPLATE.md` | L10 | 이전 단계 미해결 오류 재확인 | 실제 배포/QA 로그 확인 필요 |
| 5 | `.github/ISSUE_TEMPLATE.md` | L11 | 백그라운드 방식 수행 선언 | 승인된 작업 스케줄 로그 필요 |
| 6 | `.github/ISSUE_TEMPLATE.md` | L12 | 문서/웹뷰어 접근 승인 확인 | 접근권한 시스템 확인 필요 |
| 7 | `.github/ISSUE_TEMPLATE.md` | L13 | 다음 단계 재점검 계획 수립 | 승인된 일정표/로그 필요 |
| 8 | `.github/ISSUE_TEMPLATE.md` | L36 | 테스트/문서 업데이트 계획 수립 | 실제 테스트 계획서·실행 로그 확보 필요 |
| 9 | `.github/ISSUE_TEMPLATE.md` | L37 | 승인자 리뷰 요청 일정 기재 | 승인자 캘린더/요청 로그 필요 |

### B. PR 템플릿 절대 지령 게이트 (7건)
| # | 문서 | 라인 | 체크 항목 | 로컬 필요 사유 |
| - | - | - | - | - |
| 10 | `.github/PULL_REQUEST_TEMPLATE.md` | L2 | 이전 단계 산출물 오류 없음 동의 | 이전 단계 검증 로그 확인 필요 |
| 11 | `.github/PULL_REQUEST_TEMPLATE.md` | L3 | 변경 범위 리뷰 및 오류 식별 | 실 프로젝트 리뷰 세션 필요 |
| 12 | `.github/PULL_REQUEST_TEMPLATE.md` | L4 | 승인된 백그라운드 프로세스로 작업 | 승인 로그 필요 |
| 13 | `.github/PULL_REQUEST_TEMPLATE.md` | L5 | 문서/웹뷰어 접근 전 승인 확인 | 접근 승인 시스템 기록 필요 |
| 14 | `.github/PULL_REQUEST_TEMPLATE.md` | L6 | 오류 발견 시 재승인 절차 준수 | 재승인 요청 로그 필요 |
| 15 | `.github/PULL_REQUEST_TEMPLATE.md` | L7 | 다음 단계 재점검 계획 수립 | 이후 일정 승인 필요 |
| 16 | `.github/PULL_REQUEST_TEMPLATE.md` | L13 | 관련 테스트 실행 및 결과 첨부 | 로컬/CI 테스트 로그 필요 |

### C. ReactFlow 성능·접근성 검증 (3건)
| # | 문서 | 라인 | 체크 항목 | 로컬 필요 사유 |
| - | - | - | - | - |
| 17 | `docs/Design/frontend_layout_reactflow_checklist.md` | L23 | 100개 노드 드래그 시 16ms 유지 | 실제 브라우저 프로파일링 장비 필요 |
| 18 | `docs/Design/frontend_layout_reactflow_checklist.md` | L30 | 20/60/20 반응형 레이아웃 검증 | Playwright/실기기 뷰포트 캡처 필요 |
| 19 | `docs/Design/frontend_layout_reactflow_checklist.md` | L33 | 스크린 리더 노드/배지 안내 | NVDA/VoiceOver 등 보조공학 장비 필요 |

### D. Windows 설치 선행 조건 & 헬스체크 (6건)
| # | 문서 | 라인 | 체크 항목 | 로컬 필요 사유 |
| - | - | - | - | - |
| 20 | `docs/install_guide_ko.md` | L60 | Access Driver 64비트 설치 확인 | Windows ODBC 관리자 접근 필요 |
| 21 | `docs/install_guide_ko.md` | L65 | VPN/내부망 연결 확인 | 사내망 VPN 클라이언트 필요 |
| 22 | `docs/install_guide_ko.md` | L66 | Windows 방화벽 8000 포트 예외 | Windows Defender 관리자 권한 필요 |
| 23 | `docs/install_guide_ko.md` | L68 | 코드 서명 인증서 적용 검증 | signtool 및 서명 인증서 필요 |
| 24 | `docs/install_guide_ko.md` | L111 | `/api/health` 브라우저 확인 | VPN 연결된 Windows 브라우저 필요 |
| 25 | `docs/install_guide_ko.md` | L112 | `/api/workflow/graph` 브라우저 확인 | 동일 환경에서 재검증 필요 |

### E. 설치 검증 보고서 보완 (1건)
| # | 문서 | 라인 | 체크 항목 | 로컬 필요 사유 |
| - | - | - | - | - |
| 26 | `docs/install_verification_20250927.md` | L12 | 설치 파일 관리자 실행 캡처 업로드 | Windows 설치 마법사 실행/캡처 필요 |

### F. Lab-3 수동 QA 이슈 추적 (2건)
| # | 문서 | 라인 | 체크 항목 | 로컬 필요 사유 |
| - | - | - | - | - |
| 27 | `docs/issues/qa_manual_browser_blocker_20251002.md` | L22 | 2025-10-04 Lab-3 수동 QA 실행 | Lab-3 물리 장비 접근 필요 |
| 28 | `docs/issues/qa_manual_browser_blocker_20251002.md` | L23 | 2025-10-07 예비 슬롯 보완 | 동일 장비/네트워크 접근 필요 |

### G. Sprint 수동 QA 캡처 (7건)
| # | 문서 | 라인 | 체크 항목 | 로컬 필요 사유 |
| - | - | - | - | - |
| 29 | `docs/sprint/routing_enhancement_qa.md` | L93 | GET 단건 로드 dirty 해제 UI 캡처 | Lab-3 실기기 UI 캡처 필요 |
| 30 | `docs/sprint/routing_enhancement_qa.md` | L95 | ERP 옵션 ON payload 캡처 (1차) | 동일 |
| 31 | `docs/sprint/routing_enhancement_qa.md` | L103 | POST 409 롤백 UI 캡처 (1차) | 동일 |
| 32 | `docs/sprint/routing_enhancement_qa.md` | L105 | ERP 옵션 ON payload 캡처 (2차) | 동일 |
| 33 | `docs/sprint/routing_enhancement_qa.md` | L116 | POST 409 롤백 UI 캡처 (2차) | 동일 |
| 34 | `docs/sprint/routing_enhancement_qa.md` | L117 | GET 단건 로드 dirty 해제 캡처 (2차) | 동일 |
| 35 | `docs/sprint/routing_enhancement_qa.md` | L121 | Dirty reset 수동 검증 전체 흐름 | Lab-3 Chrome 127+ & HAR 캡처 필요 |

## 남은 작업 지시
- 상기 35건은 모두 원격 컨테이너에서 직접 완료할 수 없으므로, Windows QA 장비 및 Lab-3 실기기 세션 예약·증빙 확보 후 체크를 진행해야 합니다.
- 문서 기반으로 정리 가능한 항목(제외 3건)은 별도 문서 편집으로 처리합니다.
- 실행 로그는 `logs/task_execution_*.log` 및 관련 이슈/체크리스트에 동기화해야 합니다.

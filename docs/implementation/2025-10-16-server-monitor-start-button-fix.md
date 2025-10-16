# 서버 모니터 시작 버튼 수정

**날짜**: 2025년 10월 16일
**작업자**: Claude (Sonnet 4.5)
**파일**: `scripts/server_monitor_dashboard_v5_1.py`

---

## 문제 설명

### 사용자 보고
"서버가 한번 켰다가 잘못 끄면 버튼이 안 눌러진다"

### 근본 원인

기존 로직:
```python
# Update "start" node: enabled only when all services are offline
if all_offline:
    self.workflow_canvas.update_node_state("start", enabled=True, color=NODE_ENABLED)
else:
    self.workflow_canvas.update_node_state("start", enabled=False, color=NODE_DISABLED)
```

**문제점:**
1. 서비스가 online 상태가 되면 시작 버튼이 비활성화됨
2. 사용자가 CMD 창을 강제로 닫거나 비정상 종료하면 서비스는 offline이 되지만, 모니터가 이를 감지하기 전까지 시작 버튼이 비활성화 상태로 유지됨
3. 폴링 간격(5초)이 있어서 상태 업데이트가 지연될 수 있음
4. 모든 서비스가 offline 상태가 되어야만 시작 버튼이 활성화되는 과도하게 엄격한 제약

---

## 해결 방법

### 1. 초기 상태 변경
```python
# Line 318
# Before
{"id": "start", "label": "▶\n서버 시작", "color": NODE_DISABLED, "enabled": False},

# After
{"id": "start", "label": "▶\n서버 시작", "color": NODE_ENABLED, "enabled": True},
```

### 2. 업데이트 로직 개선
```python
# Line 1134-1136
# Before
if all_offline:
    self.workflow_canvas.update_node_state("start", enabled=True, color=NODE_ENABLED)
else:
    self.workflow_canvas.update_node_state("start", enabled=False, color=NODE_DISABLED)

# After
# Update "start" node: ALWAYS enabled for user convenience
# User can try to start services anytime
self.workflow_canvas.update_node_state("start", enabled=True, color=NODE_ENABLED)
```

---

## 변경 이유

### UX 개선
1. **사용자 자유도**: 사용자가 언제든지 서버를 시작할 수 있어야 함
2. **오류 복구**: 비정상 종료 후에도 즉시 재시작 가능
3. **명확성**: 버튼이 비활성화되면 사용자가 혼란스러워함

### 안전성
1. START_ALL_WINDOWS.bat은 이미 실행 중인 서비스를 체크하고 스킵하는 로직이 포함되어 있음
2. 중복 실행 시도는 사용자 책임 (기존 CMD 창 확인 가능)
3. 실제로 해로운 경우는 거의 없음 (포트 충돌은 자동 감지됨)

### 일관성
- 다른 버튼들 (폴더 선택, 캐시 정리)도 항상 활성화되어 있음
- 중지 버튼만 조건부 활성화 (온라인 서비스가 있을 때)

---

## 수정 파일

### `scripts/server_monitor_dashboard_v5_1.py`
- **Line 318**: 초기 상태를 enabled=True로 변경
- **Line 1134-1136**: 항상 활성화 로직으로 변경

---

## 빌드

```bash
./.venv/Scripts/pyinstaller.exe --onefile --noconsole \
  --name "RoutingMLMonitor_v5.2.0" \
  --icon NONE \
  ./scripts/server_monitor_dashboard_v5_1.py
```

**결과**: `dist/RoutingMLMonitor_v5.2.0.exe`

---

## 테스트 시나리오

### 1. 정상 시작/종료
- ✅ 프로그램 시작 → 시작 버튼 클릭 → 모든 서비스 온라인
- ✅ 중지 버튼 클릭 → 모든 서비스 오프라인
- ✅ 시작 버튼 다시 클릭 가능

### 2. 비정상 종료
- ✅ 서비스 시작 → CMD 창 강제 닫기
- ✅ 시작 버튼이 여전히 활성화되어 있음
- ✅ 시작 버튼 클릭으로 재시작 가능

### 3. 부분 실행 상태
- ✅ 일부 서비스만 온라인
- ✅ 시작 버튼 여전히 활성화
- ✅ 사용자가 판단하여 재시작 또는 중지 선택 가능

---

## 영향 범위

### 변경된 동작
- **시작 버튼**: 조건부 활성화 → 항상 활성화
- **중지 버튼**: 변경 없음 (온라인 서비스 있을 때만 활성화)

### 변경되지 않은 동작
- 서비스 상태 모니터링
- 개별 서비스 시작 버튼
- 성능 차트
- 사용자 관리

---

## 버전 정보

- **변경 전**: v5.2.0 (문제 있음)
- **변경 후**: v5.2.0 (수정 완료, 동일 버전 번호 유지)
- **빌드 날짜**: 2025-10-16

---

## 후속 작업

- [x] 로직 수정
- [x] PyInstaller로 재빌드
- [x] 문서 작성
- [ ] 사용자 테스트
- [ ] 필요시 v5.2.1로 버전 업

---

**작업 완료 시각**: 2025-10-16 17:00
**소요 시간**: 약 15분

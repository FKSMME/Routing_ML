# ADR-XXXX: [결정 제목]

**날짜**: YYYY-MM-DD
**상태**: [제안됨 | 승인됨 | 거부됨 | 대체됨 | 폐기됨]
**결정자**: [이름들]
**대체**: [이전 ADR 번호] (해당되는 경우)
**대체됨**: [새 ADR 번호] (해당되는 경우)

---

## 컨텍스트 (Context)

어떤 문제나 상황이 이 결정을 필요로 했는가?

- 현재 상황에 대한 설명
- 해결해야 할 문제
- 제약 조건 (기술적, 비즈니스적, 시간적)
- 관련 이해관계자

**예시**:
```
현재 라우팅 추천 시스템에서 모델 성능이 시간이 지남에 따라 저하되는 문제가 발생했습니다.
새로운 제품 유형이 추가되고 제조 공정이 변경되면서 학습 데이터와 실제 데이터 간 분포 차이가
발생하고 있습니다 (Concept Drift).
```

---

## 결정 (Decision)

우리는 무엇을 선택했는가? 그리고 왜?

- 선택한 솔루션의 명확한 설명
- 핵심 이유
- 예상되는 결과

**예시**:
```
KL Divergence 기반 Concept Drift 탐지 시스템을 도입하고,
7일간 5회 이상 drift 발견 시 자동으로 재학습을 트리거하기로 결정했습니다.

이유:
1. KL Divergence는 확률 분포 비교에 수학적으로 견고함
2. Scipy에 검증된 구현이 존재하여 신뢰성 높음
3. Threshold (0.5) 조정이 직관적
```

---

## 대안들 (Alternatives Considered)

고려했지만 채택하지 않은 다른 옵션들과 그 이유

### 대안 1: [옵션명]
**설명**: ...
**장점**:
- ...
**단점**:
- ...
**거부 이유**: ...

### 대안 2: [옵션명]
**설명**: ...
**장점**:
- ...
**단점**:
- ...
**거부 이유**: ...

**예시**:
```
대안 1: Kolmogorov-Smirnov (KS) Test
- 장점: 통계적으로 엄밀한 검정
- 단점: 연속 분포 가정 필요, 복잡도 높음
- 거부 이유: 이산적인 예측 점수에 적용 어려움

대안 2: ADWIN (ADaptive WINdowing)
- 장점: 온라인 drift 탐지에 최적화
- 단점: 메모리 소비 많음, 구현 복잡
- 거부 이유: 초기 프로토타입에는 과도한 복잡도
```

---

## 결과 (Consequences)

이 결정의 긍정적/부정적 영향

### 긍정적 결과
- 모델 성능 저하 조기 발견
- 자동 재학습으로 수동 개입 불필요
- 시스템 신뢰성 향상

### 부정적 결과 / 트레이드오프
- 추가 모니터링 오버헤드 (~1ms per prediction)
- False positive 발생 가능성
- Baseline 분포 관리 필요

### 완화 전략
- Threshold 튜닝으로 false positive 최소화
- 주간 리뷰를 통한 drift 이벤트 검토

---

## 구현 세부사항 (Implementation Details)

### 기술 스택
- Python 3.11
- Scipy (entropy 함수)
- FastAPI (API 엔드포인트)

### 주요 컴포넌트
1. `backend/ml/concept_drift_detector.py`: 핵심 로직
2. `backend/api/routes/drift.py`: REST API
3. 모니터링: Prometheus metrics

### 설정 파라미터
```python
WINDOW_SIZE = 1000  # 예측 롤링 윈도우
KL_THRESHOLD = 0.5  # Drift 탐지 임계값
RETRAIN_TRIGGER = 5  # 7일간 drift 이벤트 수
```

---

## 검증 계획 (Validation Plan)

이 결정이 올바른지 어떻게 확인할 것인가?

### 성공 메트릭
- Drift 탐지 정확도 > 90%
- False positive rate < 5%
- 모델 정확도 유지 > 85%

### 모니터링
- Weekly drift summary 리뷰
- 재학습 빈도 추적
- 사용자 피드백 수집

### 롤백 조건
- False positive rate > 10%
- 시스템 성능 저하 (latency > 100ms)
- 운영 부담 과다

---

## 참고 자료 (References)

- [Learning under Concept Drift: A Review (Gama et al., 2014)](https://example.com)
- [KL Divergence - Wikipedia](https://en.wikipedia.org/wiki/Kullback%E2%80%93Leibler_divergence)
- Internal: `docs/concept_drift_detection.md`
- Code: `backend/ml/concept_drift_detector.py`

---

## 메타데이터 (Metadata)

- **태그**: #machine-learning #monitoring #automation
- **관련 ADR**: ADR-0002 (월간 재학습), ADR-0003 (모델 버전 관리)
- **영향 범위**: Backend, Monitoring, MLOps
- **리뷰 주기**: 분기별 (Q1, Q2, Q3, Q4)

---

## 변경 이력 (Change Log)

| 날짜 | 변경 사항 | 작성자 |
|------|-----------|--------|
| 2025-10-06 | 초안 작성 | ML Team |
| 2025-10-10 | 승인됨 | CTO |
| 2025-11-01 | Threshold 0.5 → 0.6 조정 | ML Team |

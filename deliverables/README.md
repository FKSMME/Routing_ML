# 절대 지령
1. 각 단계는 승인 후에만 진행한다.
2. 단계 착수 전 이번 단계 전체 범위를 리뷰하고 오류를 식별한다.
3. 오류 발견 시 수정 전에 승인 재요청한다.
4. 이전 단계 오류가 없음을 재확인한 뒤 다음 단계 승인을 요청한다.
5. 모든 단계 작업은 백그라운드 방식으로 수행한다.
6. 문서/웹뷰어 점검이 필요한 경우 반드시 승인 확인 후 진행한다.
7. 다음 단계 착수 전에 이전 단계 전반을 재점검하여 미해결 오류가 없는지 확인한다.

# 전달물 패키지 구조

```
deliverables/
  README.md                  # 본 문서
  v1.0/
    models/                  # 학습 결과 (HNSW, metadata, projector)
    reports/
      stage7_operations.pdf
      stage8_documentation.pdf
      kpi_weekly.csv
    docs/
      quickstart.pdf
      release_notes.pdf
    sql/
      routing_candidates_sample.csv
      routing_candidate_operations_sample.csv
```

## 구성 원칙
- 모든 파일은 사내망 NAS에 업로드하며, 외부 공유 금지.
- 모델/보고서/문서를 버전 폴더로 묶고, README에 변경 내역 링크를 남긴다.
- SQL 샘플은 Stage 5 스키마를 따르고, 개인정보는 제거한다.
- 보고서(PDF)는 각 Stage 문서를 PDF로 내보낸 후 포함한다.

## 배포 체크리스트
- [ ] Stage 7/8 보고서를 PDF로 변환하여 `reports/`에 추가했다.
- [ ] 최신 모델 아티팩트를 `models/`에 저장했다.
- [ ] KPI CSV가 Stage 6 지표와 동일한지 검증했다.
- [ ] 릴리스 노트와 빠른 시작 가이드를 PDF로 변환했다.
- [ ] NAS 업로드 후 무결성(SHA256) 확인을 완료했다.

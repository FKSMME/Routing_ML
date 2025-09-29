# QA, Logging & Metrics Coverage Plan

## Objectives
- Define validation scope that ensures routing refactor changes meet performance and reliability SLOs.
- Align structured logging, metrics, and alerting with manifest/registry lifecycle events.

## QA Coverage
| Area | Tests | Tools |
| --- | --- | --- |
| Contract Validation | Manifest schema lint, registry activation toggle, mapping profile CRUD. | `pytest`, `pydantic`, JSON schema CLI. |
| Functional | Routing CRUD, drag/drop rules, inference preview accuracy. | `pytest`, Cypress, offline mock servers. |
| Performance | HNSW query latency, preprocessing throughput, dashboard rendering. | `pytest-benchmark`, custom scripts. |
| Security | Auth roles, JWT expiration, audit log tamper detection. | OWASP ZAP offline, unit tests. |

## Logging Strategy
- Structured JSON logs across backend services with fields: `ts`, `request_id`, `user_id`, `active_version`, `latency_ms`, `cache_hit`, `ef_search`.
- Log rotation via size (100 MB) or age (7 days) integrated with Windows Event Log forwarding.
- Audit logs stored separately with immutable append-only semantics.

## Metrics & Dashboards
| Metric | Source | Target |
| --- | --- | --- |
| Prediction latency p95 | Inference service | < 2s |
| Training job duration | Scheduler logs | Baseline + 10% tolerance |
| Registry activation count | Registry API | Alert if > 5 per day |
| Rule violation rate | Frontend telemetry | Track < 3% per session |

## Alerting
- `/health` endpoint monitors: manifest load, registry DSN, cache status.
- Windows Task Scheduler job verifies installer success; sends alert if failure exit code detected.
- PagerDuty integration for sustained p95 breach (> 15 minutes).

## Reporting Cadence
- Daily digest summarizing key metrics delivered via email export (CSV) for offline review.
- Weekly QA status update referencing coverage percentages and defect backlog.
- Monthly compliance report verifying audit log completeness.

## Follow-up
- Implement log ingestion pipeline to operations dashboard (HTML/JS single-page app).
- Automate anomaly detection for ef_search adjustments using z-score thresholds.
- Document `/health` contract in API handbook.

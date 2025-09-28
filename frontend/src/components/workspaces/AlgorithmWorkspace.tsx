import { Download, Play, RefreshCcw, Save, Settings2, Upload } from "lucide-react";
import { useMemo, useState } from "react";

const NODE_LIBRARY = [
  { id: "trainer.load", label: "Load Training Data", description: "Access · CSV · Parquet" },
  { id: "trainer.clean", label: "Data Cleansing", description: "Outlier clipping, scaling" },
  { id: "trainer.train", label: "Train Model", description: "XGBoost / Neural Net" },
  { id: "predictor.prepare", label: "Prepare Features", description: "Feature engineering" },
  { id: "predictor.simulate", label: "Simulate Routing", description: "Monte Carlo · Heuristic" },
  { id: "predictor.export", label: "ERP Interface", description: "CSV · XML · REST" },
];

const BLUEPRINT_NODES = [
  { id: "source", label: "Source Data", type: "data", status: "ready", description: "Access / Supabase" },
  { id: "cleansing", label: "Cleanser", type: "transform", status: "warning", description: "11 rules active" },
  { id: "trainer", label: "Trainer", type: "ml", status: "running", description: "Gradient Boosting" },
  { id: "artifact", label: "Artifact Store", type: "storage", status: "ready", description: "models/v2025-09-28" },
  { id: "predictor", label: "Predictor", type: "ml", status: "ready", description: "Runtime ML" },
  { id: "export", label: "ERP Interface", type: "io", status: "disabled", description: "Options OFF" },
];

const INSPECTOR_SECTIONS = [
  {
    title: "입력 파라미터",
    fields: [
      { label: "데이터 소스", value: "Access/ROUTING.accdb" },
      { label: "추출 컬럼", value: "ITEM_CD, ROUTING_ID, PROC_SEQ" },
      { label: "필터", value: "STATUS = 'ACTIVE'" },
    ],
  },
  {
    title: "하이퍼파라미터",
    fields: [
      { label: "max_depth", value: "12" },
      { label: "learning_rate", value: "0.08" },
      { label: "rounds", value: "250" },
    ],
  },
];

const RUN_HISTORY = [
  { id: "run-18", timestamp: "2025-09-28 05:40", summary: "성공 · RMSE 0.89" },
  { id: "run-17", timestamp: "2025-09-27 22:15", summary: "성공 · RMSE 0.94" },
  { id: "run-16", timestamp: "2025-09-27 18:02", summary: "실패 · 데이터 누락" },
];

export function AlgorithmWorkspace() {
  const [selectedNode, setSelectedNode] = useState<string | null>("trainer");
  const inspector = useMemo(() => INSPECTOR_SECTIONS, []);

  return (
    <div className="algorithm-workspace" role="region" aria-label="알고리즘 편집 워크스페이스">
      <div className="workspace-grid algorithm-grid">
        <aside className="algorithm-column algorithm-column--library">
          <header className="workspace-panel__header">
            <h2>노드 라이브러리</h2>
            <p>Trainer · Predictor · Utility</p>
          </header>
          <div className="workspace-search">
            <input type="search" placeholder="노드 검색" />
          </div>
          <ul className="algorithm-library" role="list">
            {NODE_LIBRARY.map((node) => (
              <li key={node.id} role="listitem">
                <button type="button" className="algorithm-library__item" onClick={() => setSelectedNode(node.id)}>
                  <span className="algorithm-library__label">{node.label}</span>
                  <span className="algorithm-library__desc">{node.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="algorithm-column algorithm-column--canvas">
          <header className="workspace-panel__header">
            <h2>블루프린트 캔버스</h2>
            <div className="workspace-toolbar">
              <button type="button" className="workspace-toolbar__btn">
                <RefreshCcw size={14} /> 정렬
              </button>
              <button type="button" className="workspace-toolbar__btn">
                <Save size={14} /> 저장
              </button>
              <button type="button" className="workspace-toolbar__btn">
                <Play size={14} /> 실행
              </button>
            </div>
          </header>
          <div className="algorithm-canvas" aria-label="블루프린트 노드">
            {BLUEPRINT_NODES.map((node) => (
              <div
                key={node.id}
                className={`algorithm-node algorithm-node--${node.type}`}
                data-status={node.status}
                onClick={() => setSelectedNode(node.id)}
              >
                <header className="algorithm-node__header">
                  <span className="algorithm-node__title">{node.label}</span>
                  <span className="algorithm-node__status">{node.status}</span>
                </header>
                <p className="algorithm-node__body">{node.description}</p>
                <footer className="algorithm-node__footer">#{node.id}</footer>
              </div>
            ))}
          </div>
        </section>

        <aside className="algorithm-column algorithm-column--inspector">
          <header className="workspace-panel__header">
            <h2>인스펙터</h2>
            <p>{selectedNode ?? "노드를 선택하세요"}</p>
          </header>
          <div className="inspector-sections">
            {inspector.map((section) => (
              <section key={section.title} className="inspector-section">
                <h3>{section.title}</h3>
                <ul>
                  {section.fields.map((field) => (
                    <li key={field.label}>
                      <span>{field.label}</span>
                      <span>{field.value}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="inspector-actions">
            <button type="button" className="primary-button">
              <Settings2 size={16} /> 설정 열기
            </button>
            <button type="button" className="btn-secondary">
              <Download size={16} /> JSON 내보내기
            </button>
            <button type="button" className="btn-secondary">
              <Upload size={16} /> JSON 가져오기
            </button>
          </div>
        </aside>
      </div>

      <section className="panel-card algorithm-history">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">실행 이력</h2>
            <p className="panel-subtitle">최근 학습/추론 실행 기록</p>
          </div>
        </header>
        <ul className="algorithm-history__list">
          {RUN_HISTORY.map((item) => (
            <li key={item.id}>
              <span className="algorithm-history__time">{item.timestamp}</span>
              <span className="algorithm-history__summary">{item.summary}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

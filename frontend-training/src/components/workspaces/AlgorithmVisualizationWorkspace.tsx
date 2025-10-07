import React, { useMemo, useState, useCallback } from 'react';
import { FileCode, Play, Save, RotateCcw } from 'lucide-react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  type Edge,
  type Node,
  type ReactFlowInstance,
  Position,
} from 'reactflow';
import { FilePropertyModal } from '../modals/FilePropertyModal';

interface PythonFile {
  id: string;
  name: string;
  path: string;
  type: 'training' | 'prediction' | 'preprocessing' | 'utility';
}

const PYTHON_FILES: PythonFile[] = [
  { id: '1', name: 'train_model.py', path: 'backend/training/train_model.py', type: 'training' },
  { id: '2', name: 'prediction.py', path: 'backend/api/prediction.py', type: 'prediction' },
  { id: '3', name: 'preprocessing.py', path: 'backend/data/preprocessing.py', type: 'preprocessing' },
  { id: '4', name: 'feature_engineering.py', path: 'backend/data/feature_engineering.py', type: 'preprocessing' },
  { id: '5', name: 'model_utils.py', path: 'backend/utils/model_utils.py', type: 'utility' },
  { id: '6', name: 'data_loader.py', path: 'backend/data/data_loader.py', type: 'utility' },
];

type FlowStep = {
  id: string;
  label: string;
  position: { x: number; y: number };
  description: string;
};

interface FileFlowDefinition {
  summary: string;
  steps: FlowStep[];
  edges: Array<{ source: string; target: string; label?: string }>;
}

const FLOW_LIBRARY: Record<string, FileFlowDefinition> = {
  '1': {
    summary: 'Raw 생산 데이터를 전처리하고 신규 라우팅 모델을 학습합니다.',
    steps: [
      { id: 'data-ingest', label: '데이터 수집', position: { x: 0, y: 0 }, description: 'Access · CSV · API 소스에서 최신 생산 데이터를 로드합니다.' },
      { id: 'feature-build', label: '피처 엔지니어링', position: { x: 220, y: -40 }, description: '엔지니어링 규칙과 통계로 신규 피처를 구성합니다.' },
      { id: 'normalize', label: '정규화', position: { x: 220, y: 80 }, description: 'MinMax/StandardScaler로 수치형 피처를 정규화합니다.' },
      { id: 'train', label: '모델 학습', position: { x: 460, y: 0 }, description: 'LightGBM + 파이프라인 튜닝으로 최종 모델을 학습합니다.' },
      { id: 'export', label: '모델 아티팩트 저장', position: { x: 700, y: 0 }, description: '모델 가중치와 메타데이터를 S3/로컬에 저장합니다.' },
    ],
    edges: [
      { source: 'data-ingest', target: 'feature-build', label: '데이터프레임' },
      { source: 'data-ingest', target: 'normalize', label: '스케일링 입력' },
      { source: 'feature-build', target: 'train', label: '피처 세트' },
      { source: 'normalize', target: 'train', label: '정규화 값' },
      { source: 'train', target: 'export', label: '학습 결과' },
    ],
  },
  '2': {
    summary: '훈련된 모델을 불러와 실시간 라우팅을 예측합니다.',
    steps: [
      { id: 'load-model', label: '모델 로드', position: { x: 0, y: 0 }, description: '가장 최근 학습된 모델 가중치를 메모리에 로드합니다.' },
      { id: 'candidate-search', label: '후보 탐색', position: { x: 220, y: -40 }, description: 'Faiss/HNSW로 유사 공정 후보를 조회합니다.' },
      { id: 'scoring', label: '스코어 계산', position: { x: 220, y: 80 }, description: '유사도/비용/시간 가중치를 조합해 점수를 계산합니다.' },
      { id: 'ranking', label: '상위 라우팅 선정', position: { x: 460, y: 0 }, description: 'Top-K 라우팅을 점수 순으로 정렬합니다.' },
      { id: 'serialize', label: 'ERP 직렬화', position: { x: 700, y: 0 }, description: 'ERP/Access 저장 형식으로 결과를 직렬화합니다.' },
    ],
    edges: [
      { source: 'load-model', target: 'candidate-search', label: '임베딩 인덱스' },
      { source: 'load-model', target: 'scoring', label: '모델 컨텍스트' },
      { source: 'candidate-search', target: 'ranking', label: '후보 리스트' },
      { source: 'scoring', target: 'ranking', label: '점수' },
      { source: 'ranking', target: 'serialize', label: 'Top-K 결과' },
    ],
  },
  '3': {
    summary: '원천 데이터를 정제하고 누락값과 이상치를 처리합니다.',
    steps: [
      { id: 'raw-load', label: '로우데이터 적재', position: { x: 0, y: 0 }, description: '원천 Access/CSV 파일을 병합합니다.' },
      { id: 'null-handle', label: '결측치 처리', position: { x: 220, y: -40 }, description: '임계치/중앙값으로 결측치를 보강합니다.' },
      { id: 'outlier', label: '이상치 정제', position: { x: 220, y: 80 }, description: 'IQR/3σ 기준으로 이상치를 제거합니다.' },
      { id: 'export-clean', label: '정제 데이터 출력', position: { x: 460, y: 0 }, description: '전처리된 데이터를 parquet/csv로 저장합니다.' },
    ],
    edges: [
      { source: 'raw-load', target: 'null-handle' },
      { source: 'raw-load', target: 'outlier' },
      { source: 'null-handle', target: 'export-clean' },
      { source: 'outlier', target: 'export-clean' },
    ],
  },
  '4': {
    summary: '피처 엔지니어링 규칙으로 라우팅 품질을 높입니다.',
    steps: [
      { id: 'ingest', label: '데이터 인입', position: { x: 0, y: 0 }, description: '가공 로그/ERP 기록을 로드합니다.' },
      { id: 'rule-based', label: '규칙 기반 특성', position: { x: 220, y: -60 }, description: '도메인 규칙으로 파생 변수 생성 (예: 난이도 등급).' },
      { id: 'stat-feature', label: '통계 특성', position: { x: 220, y: 60 }, description: '창(window) 기반 통계 피처 계산.' },
      { id: 'feature-store', label: 'Feature Store 저장', position: { x: 460, y: 0 }, description: 'Feature Store/Redis에 저장하여 추론 시 재사용.' },
    ],
    edges: [
      { source: 'ingest', target: 'rule-based' },
      { source: 'ingest', target: 'stat-feature' },
      { source: 'rule-based', target: 'feature-store' },
      { source: 'stat-feature', target: 'feature-store' },
    ],
  },
  '5': {
    summary: '모델 유틸 함수가 어떤 흐름으로 호출되는지 정리합니다.',
    steps: [
      { id: 'load-utils', label: '유틸 로드', position: { x: 0, y: 0 }, description: '공통 유틸 함수를 메모리에 로드.' },
      { id: 'apply-metrics', label: '평가지표 계산', position: { x: 220, y: -40 }, description: '정확도, 리콜, 비용절감률 등 모델 지표 계산.' },
      { id: 'log-export', label: '로그/리포트 출력', position: { x: 460, y: 0 }, description: 'Slack/Teams 알림과 리포트 파일 생성.' },
    ],
    edges: [
      { source: 'load-utils', target: 'apply-metrics' },
      { source: 'apply-metrics', target: 'log-export' },
    ],
  },
  '6': {
    summary: '데이터 로더가 훈련/예측에 필요한 데이터를 제공합니다.',
    steps: [
      { id: 'connect', label: 'DB 연결', position: { x: 0, y: 0 }, description: 'MSSQL/Access, S3 등 소스에 연결합니다.' },
      { id: 'extract', label: '데이터 추출', position: { x: 220, y: -40 }, description: '필요한 테이블과 컬럼을 추출합니다.' },
      { id: 'transform', label: '변환 & 캐싱', position: { x: 220, y: 80 }, description: '타입 변환, 캐싱, 배치 처리를 수행합니다.' },
      { id: 'deliver', label: '배포', position: { x: 460, y: 0 }, description: '훈련/예측 파이프라인에 데이터를 전달합니다.' },
    ],
    edges: [
      { source: 'connect', target: 'extract' },
      { source: 'extract', target: 'transform' },
      { source: 'transform', target: 'deliver' },
    ],
  },
};

export const AlgorithmVisualizationWorkspace: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFileInfo, setModalFileInfo] = useState<any>(null);

  const getFileTypeColor = (type: PythonFile['type']) => {
    switch (type) {
      case 'training':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'prediction':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'preprocessing':
        return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
      case 'utility':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      default:
        return 'bg-slate-500/10 border-slate-500/30 text-slate-400';
    }
  };

  const flowDefinition = selectedFile ? FLOW_LIBRARY[selectedFile] : undefined;

  const flowNodes = useMemo<Node[]>(() => {
    if (!flowDefinition) {
      return [];
    }
    return flowDefinition.steps.map((step) => ({
      id: step.id,
      data: { label: step.label },
      position: step.position,
      type: 'default',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        borderRadius: 16,
        padding: '12px 16px',
        border: '1px solid rgba(148, 163, 184, 0.35)',
        background: 'rgba(15, 23, 42, 0.75)',
        color: '#e2e8f0',
        fontWeight: 600,
        boxShadow: '0 10px 25px rgba(15, 23, 42, 0.35)',
      },
    }));
  }, [flowDefinition]);

  const flowEdges = useMemo<Edge[]>(() => {
    if (!flowDefinition) {
      return [];
    }
    return flowDefinition.edges.map((edge) => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: true,
      style: { strokeWidth: 2, stroke: '#38bdf8' },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 8,
      labelBgStyle: { fill: 'rgba(8, 47, 73, 0.85)', stroke: 'rgba(125, 211, 252, 0.45)' },
      labelStyle: { fill: '#bae6fd', fontSize: 11, fontWeight: 600 },
    }));
  }, [flowDefinition]);

  const handleFileSelect = (fileId: string) => {
    setSelectedFile(fileId);
    setTimeout(() => {
      reactFlowInstance?.fitView({ padding: 0.2 });
    }, 0);
  };

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
    if (flowNodes.length > 0) {
      instance.fitView({ padding: 0.2, duration: 300 });
    }
  }, [flowNodes.length]);

  const handleFileDoubleClick = (file: PythonFile) => {
    // 데모 데이터로 파일 정보 표시
    setModalFileInfo({
      name: file.name,
      path: file.path,
      type: file.type,
      size: '2.4 KB',
      lastModified: '2025-10-07 14:30',
      functions: [
        'train_model',
        'load_data',
        'preprocess',
        'evaluate_model',
        'save_checkpoint',
        'load_checkpoint'
      ],
      classes: [
        'ModelTrainer',
        'DataLoader',
        'Preprocessor'
      ],
      imports: [
        'import pandas as pd',
        'import numpy as np',
        'from sklearn.model_selection import train_test_split',
        'import lightgbm as lgb'
      ]
    });
    setIsModalOpen(true);
  };

  return (
    <div
      className="algorithm-visualization-workspace flex w-full bg-slate-950"
      style={{ height: 'calc(100vh - 150px)', minHeight: '600px' }}
      data-version="v3"
    >
      {/* 좌측 패널: 파일 목록 (20% 너비) */}
      <div className="file-panel w-1/5 min-w-[250px] border-r border-slate-700/50 bg-slate-900/50 p-4 overflow-y-auto flex-shrink-0">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
            <FileCode className="w-4 h-4" />
            Python Files
          </h3>
          <input
            type="text"
            placeholder="Search files..."
            className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700/50 rounded-lg
                     text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="space-y-2">
          {PYTHON_FILES.map((file) => (
            <button
              key={file.id}
              onClick={() => handleFileSelect(file.id)}
              onDoubleClick={() => handleFileDoubleClick(file)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-200
                ${
                  selectedFile === file.id
                    ? 'bg-blue-500/20 border-blue-500/50 shadow-lg shadow-blue-500/20'
                    : `${getFileTypeColor(file.type)} hover:bg-opacity-20`
                }`}
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{file.name}</div>
                  <div className="text-xs text-slate-500 truncate">{file.path}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <div className="text-xs text-slate-500 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500/30"></div>
              <span>Training</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500/30"></div>
              <span>Prediction</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500/30"></div>
              <span>Preprocessing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500/30"></div>
              <span>Utility</span>
            </div>
          </div>
        </div>
      </div>

      {/* 우측 캔버스: 노드 시각화 (80% 너비) */}
      <div className="algorithm-canvas flex-1 flex flex-col bg-slate-950/50">
        {/* 툴바 */}
        <div className="toolbar flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-900/30">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-300">
              {selectedFile
                ? PYTHON_FILES.find((f) => f.id === selectedFile)?.name
                : 'Select a file to visualize'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 text-sm bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50
                       rounded-lg text-slate-300 transition-colors flex items-center gap-2"
              title="Run analysis"
            >
              <Play className="w-4 h-4" />
              Analyze
            </button>
            <button
              className="px-3 py-1.5 text-sm bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50
                       rounded-lg text-blue-400 transition-colors flex items-center gap-2"
              title="Save layout"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              className="px-3 py-1.5 text-sm bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50
                       rounded-lg text-slate-300 transition-colors flex items-center gap-2"
              title="Reset layout"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        {/* 캔버스 영역 */}
        <div className="canvas-container flex-1 relative bg-gradient-to-br from-slate-950 to-slate-900">
          {selectedFile && flowDefinition ? (
            <ReactFlowProvider>
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                fitView
                className="h-full"
                onInit={handleInit}
              >
                <MiniMap pannable zoomable style={{ background: 'rgba(15, 23, 42, 0.75)' }} />
                <Controls position="bottom-right" />
                <Background gap={24} color="#1e293b" />
              </ReactFlow>
            </ReactFlowProvider>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <FileCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">No File Selected</p>
                <p className="text-sm">Select a Python file from the left panel to visualize its algorithm flow</p>
              </div>
            </div>
          )}

          {/* 그리드 배경 (픽셀 라인) */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgb(148 163 184) 1px, transparent 1px),
                linear-gradient(to bottom, rgb(148 163 184) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
            }}
          />
        </div>

        <div className="border-t border-slate-800/60 bg-slate-900/40 px-6 py-4 text-sm text-slate-300">
          {selectedFile && flowDefinition ? (
            <>
              <div className="font-semibold text-slate-200 mb-2">파이프라인 요약</div>
              <p className="text-slate-400 text-sm mb-3">{flowDefinition.summary}</p>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {flowDefinition.steps.map((step) => (
                  <div key={step.id} className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-blue-300/80">{step.label}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">{step.description}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-slate-400">좌측에서 Python 파일을 선택하면 파이프라인 요약과 노드 흐름이 표시됩니다.</p>
          )}
        </div>
      </div>

      {/* File Property Modal */}
      <FilePropertyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        fileInfo={modalFileInfo}
      />
    </div>
  );
};

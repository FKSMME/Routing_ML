import axios from 'axios';
import dagre from 'dagre';
import { FileCode, Play, RotateCcw,Save } from 'lucide-react';
import React, { memo,useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Connection,
  ConnectionMode,
  Controls,
  type Edge,
  type EdgeChange,
  Handle,
  type Node,
  type NodeChange,
  type NodeProps,
  Position,
  type ReactFlowInstance,
  ReactFlowProvider,
} from 'reactflow';

import { FilePropertyModal } from '../modals/FilePropertyModal';

interface PythonFile {
  id: string;
  name: string;
  path: string;
  full_path?: string;
  type: 'training' | 'prediction' | 'preprocessing' | 'utility';
  functions?: number;
  classes?: number;
}

interface FunctionNodeData {
  label: string;
  type: 'function' | 'class' | 'method';
  params?: string[];
  returns?: string;
  docstring?: string;
  lineStart?: number;
  lineEnd?: number;
  sourceCode?: string;
}

interface APINode {
  id: string;
  label: string;
  type: 'function' | 'class' | 'method';
  params: string[];
  returns: string;
  docstring: string;
  lineStart: number;
  lineEnd: number;
  sourceCode: string;
}

interface APIEdge {
  source: string;
  target: string;
  label?: string;
}

const normalizeBackendPath = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const slashified = trimmed.replace(/\\/g, '/').replace(/^\.\/+/, '');
  const withoutLeadingSlash = slashified.startsWith('/') ? slashified.slice(1) : slashified;

  if (withoutLeadingSlash.startsWith('backend/')) {
    return withoutLeadingSlash;
  }

  const backendIndex = withoutLeadingSlash.indexOf('backend/');
  if (backendIndex !== -1) {
    return withoutLeadingSlash.slice(backendIndex);
  }

  return `backend/${withoutLeadingSlash.replace(/^backend\//, '')}`;
};

// 커스텀 노드 컴포넌트
const FunctionNode = memo(({ data }: NodeProps<FunctionNodeData>) => {
  const isClass = data.type === 'class';
  const isMethod = data.type === 'method';

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 shadow-lg min-w-[200px] max-w-[280px]
        ${isClass
          ? 'bg-gradient-to-br from-emerald-900/90 to-emerald-950/90 border-emerald-500/50'
          : 'bg-gradient-to-br from-blue-900/90 to-blue-950/90 border-blue-500/50'}`}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-sky-400" />

      <div className="space-y-1">
        <div className={`text-sm font-bold ${isClass ? 'text-emerald-200' : 'text-blue-200'}`}>
          {isMethod && <span className="text-xs mr-1">📎</span>}
          {data.label}
        </div>

        {data.params && data.params.length > 0 && (
          <div className="text-xs text-slate-300 space-y-0.5">
            {data.params.map((param, idx) => (
              <div key={idx} className="truncate">
                <span className="text-sky-300">• </span>
                {param}
              </div>
            ))}
          </div>
        )}

        {data.returns && (
          <div className="text-xs text-slate-400 mt-1">
            → {data.returns}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-sky-400" />
    </div>
  );
});

FunctionNode.displayName = 'FunctionNode';

const nodeTypes = {
  functionNode: FunctionNode,
};

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
  'trainer_ml.py': {
    summary: 'Raw 생산 데이터를 전처리하고 신규 라우팅 모델을 학습합니다.',
    steps: [
      { id: 'data-ingest', label: '데이터 수집', position: { x: 0, y: 0 }, description: 'MSSQL · CSV · API 소스에서 최신 생산 데이터를 로드합니다.' },
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
  'trainer_ml': {
    summary: 'Raw 생산 데이터를 전처리하고 신규 라우팅 모델을 학습합니다.',
    steps: [
      { id: 'data-ingest', label: '데이터 수집', position: { x: 0, y: 0 }, description: 'MSSQL · CSV · API 소스에서 최신 생산 데이터를 로드합니다.' },
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
  'training_service': {
    summary: 'Training service API가 모델 학습 요청을 처리합니다.',
    steps: [
      { id: 'api-receive', label: 'API 요청 수신', position: { x: 0, y: 0 }, description: 'FastAPI 엔드포인트에서 학습 요청을 받습니다.' },
      { id: 'validate', label: '파라미터 검증', position: { x: 220, y: -40 }, description: '학습 파라미터와 데이터 경로를 검증합니다.' },
      { id: 'call-trainer', label: 'Trainer 호출', position: { x: 220, y: 80 }, description: 'trainer_ml.py의 학습 함수를 비동기 호출합니다.' },
      { id: 'monitor', label: '진행 상황 모니터링', position: { x: 460, y: 0 }, description: '학습 진행률과 메트릭을 실시간 추적합니다.' },
      { id: 'response', label: 'API 응답', position: { x: 700, y: 0 }, description: '학습 결과와 메타데이터를 JSON으로 반환합니다.' },
    ],
    edges: [
      { source: 'api-receive', target: 'validate' },
      { source: 'validate', target: 'call-trainer' },
      { source: 'call-trainer', target: 'monitor' },
      { source: 'monitor', target: 'response' },
    ],
  },
  'predictor_ml': {
    summary: '훈련된 모델을 불러와 실시간 라우팅을 예측합니다.',
    steps: [
      { id: 'load-model', label: '모델 로드', position: { x: 0, y: 0 }, description: '가장 최근 학습된 모델 가중치를 메모리에 로드합니다.' },
      { id: 'candidate-search', label: '후보 탐색', position: { x: 220, y: -40 }, description: 'Faiss/HNSW로 유사 공정 후보를 조회합니다.' },
      { id: 'scoring', label: '스코어 계산', position: { x: 220, y: 80 }, description: '유사도/비용/시간 가중치를 조합해 점수를 계산합니다.' },
      { id: 'ranking', label: '상위 라우팅 선정', position: { x: 460, y: 0 }, description: 'Top-K 라우팅을 점수 순으로 정렬합니다.' },
      { id: 'serialize', label: 'ERP 직렬화', position: { x: 700, y: 0 }, description: 'ERP/MSSQL 저장 형식으로 결과를 직렬화합니다.' },
    ],
    edges: [
      { source: 'load-model', target: 'candidate-search', label: '임베딩 인덱스' },
      { source: 'load-model', target: 'scoring', label: '모델 컨텍스트' },
      { source: 'candidate-search', target: 'ranking', label: '후보 리스트' },
      { source: 'scoring', target: 'ranking', label: '점수' },
      { source: 'ranking', target: 'serialize', label: 'Top-K 결과' },
    ],
  },
  'prediction_service': {
    summary: 'Prediction service API가 라우팅 예측 요청을 처리합니다.',
    steps: [
      { id: 'api-receive', label: 'API 요청 수신', position: { x: 0, y: 0 }, description: 'FastAPI 엔드포인트에서 예측 요청을 받습니다.' },
      { id: 'parse-input', label: '입력 파싱', position: { x: 220, y: -40 }, description: '품목 정보와 제약 조건을 파싱합니다.' },
      { id: 'call-predictor', label: 'Predictor 호출', position: { x: 220, y: 80 }, description: 'predictor_ml.py의 예측 함수를 호출합니다.' },
      { id: 'format-result', label: '결과 포맷팅', position: { x: 460, y: 0 }, description: 'ERP 인터페이스 형식으로 결과를 변환합니다.' },
      { id: 'response', label: 'API 응답', position: { x: 700, y: 0 }, description: '예측된 라우팅을 JSON으로 반환합니다.' },
    ],
    edges: [
      { source: 'api-receive', target: 'parse-input' },
      { source: 'parse-input', target: 'call-predictor' },
      { source: 'call-predictor', target: 'format-result' },
      { source: 'format-result', target: 'response' },
    ],
  },
  'database': {
    summary: 'MSSQL 데이터베이스 연결과 CRUD 작업을 관리합니다.',
    steps: [
      { id: 'connect', label: 'DB 연결 풀', position: { x: 0, y: 0 }, description: 'SQLAlchemy 연결 풀을 초기화합니다.' },
      { id: 'query', label: '쿼리 실행', position: { x: 220, y: -40 }, description: 'SELECT/INSERT/UPDATE 쿼리를 실행합니다.' },
      { id: 'transaction', label: '트랜잭션 관리', position: { x: 220, y: 80 }, description: 'ACID 트랜잭션을 보장하고 롤백을 처리합니다.' },
      { id: 'result', label: '결과 반환', position: { x: 460, y: 0 }, description: '쿼리 결과를 Python 객체로 매핑합니다.' },
    ],
    edges: [
      { source: 'connect', target: 'query' },
      { source: 'connect', target: 'transaction' },
      { source: 'query', target: 'result' },
      { source: 'transaction', target: 'result' },
    ],
  },
  'feature_weights': {
    summary: '피처 가중치를 계산하고 저장하는 유틸리티입니다.',
    steps: [
      { id: 'load-history', label: '이력 로드', position: { x: 0, y: 0 }, description: '과거 학습 이력과 피처 중요도를 로드합니다.' },
      { id: 'calculate', label: '가중치 계산', position: { x: 220, y: -40 }, description: 'SHAP/LIME 기반으로 피처 가중치를 계산합니다.' },
      { id: 'normalize', label: '정규화', position: { x: 220, y: 80 }, description: '가중치를 0-1 범위로 정규화합니다.' },
      { id: 'save', label: '저장', position: { x: 460, y: 0 }, description: '가중치를 JSON/DB에 저장합니다.' },
    ],
    edges: [
      { source: 'load-history', target: 'calculate' },
      { source: 'calculate', target: 'normalize' },
      { source: 'normalize', target: 'save' },
    ],
  },
};

// Dagre 레이아웃 함수
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', ranksep: 150, nodesep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 240, height: 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 120,
        y: nodeWithPosition.y - 50,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export const AlgorithmVisualizationWorkspace: React.FC = () => {
  // State
  const [allPythonFiles, setAllPythonFiles] = useState<PythonFile[]>([]); // All files from API
  const [selectedFile, setSelectedFile] = useState<PythonFile | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null); // For static mode
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFileInfo, setModalFileInfo] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'static' | 'dynamic' | 'summary'>('static'); // 'static' = Rainbow Balls, 'dynamic' = Real AST

  // Load Python files from API on mount
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await axios.get('/api/algorithm-viz/files', {
          params: {
            directory: 'backend',
            include_training: true,
          },
        });
        const files: PythonFile[] = Array.isArray(response.data)
          ? response.data
              .map((file: any) => {
                const normalizedPath =
                  normalizeBackendPath(typeof file.path === 'string' ? file.path : undefined) ??
                  normalizeBackendPath(typeof file.full_path === 'string' ? file.full_path : undefined);

                const normalizedFullPath =
                  typeof file.full_path === 'string' ? file.full_path.replace(/\\/g, '/') : undefined;

                const mappedType = (() => {
                  const rawType = typeof file.type === 'string' ? file.type.toLowerCase() : '';
                  if (rawType === 'training' || rawType === 'prediction' || rawType === 'preprocessing') {
                    return rawType;
                  }
                  return 'utility';
                })() as PythonFile['type'];

                if (!normalizedPath) {
                  return null;
                }

                return {
                  id: String(file.id ?? normalizedPath),
                  name: typeof file.name === 'string' ? file.name : normalizedPath.split('/').pop() ?? 'unknown.py',
                  path: normalizedPath,
                  full_path: normalizedFullPath,
                  type: mappedType,
                  functions: typeof file.functions === 'number' ? file.functions : 0,
                  classes: typeof file.classes === 'number' ? file.classes : 0,
                } as PythonFile;
              })
              .filter((item: PythonFile | null): item is PythonFile => item !== null)
          : [];

        setAllPythonFiles(files);
      } catch (error) {
        console.error('Failed to fetch Python files:', error);
      }
    };

    fetchFiles();
  }, []);

  // Compute displayed files based on viewMode (using useMemo instead of useEffect)
  const displayedFiles = useMemo(() => {
    // Rainbow mode: Show only the 6 hardcoded files
    if (viewMode === 'static') {
      return [
        {
          id: 'trainer_ml',
          name: 'trainer_ml.py',
          path: 'backend/trainer_ml.py',
          full_path: '/workspaces/Routing_ML_4/backend/trainer_ml.py',
          size: 58301,
          functions: 32,
          classes: 0,
          type: 'training' as const,
        },
        {
          id: 'training_service',
          name: 'training_service.py',
          path: 'backend/api/services/training_service.py',
          full_path: '/workspaces/Routing_ML_4/backend/api/services/training_service.py',
          size: 25600,
          functions: 17,
          classes: 0,
          type: 'training' as const,
        },
        {
          id: 'predictor_ml',
          name: 'predictor_ml.py',
          path: 'backend/predictor_ml.py',
          full_path: '/workspaces/Routing_ML_4/backend/predictor_ml.py',
          size: 77278,
          functions: 51,
          classes: 0,
          type: 'prediction' as const,
        },
        {
          id: 'prediction_service',
          name: 'prediction_service.py',
          path: 'backend/api/services/prediction_service.py',
          full_path: '/workspaces/Routing_ML_4/backend/api/services/prediction_service.py',
          size: 42100,
          functions: 56,
          classes: 0,
          type: 'prediction' as const,
        },
        {
          id: 'database',
          name: 'database.py',
          path: 'backend/database.py',
          full_path: '/workspaces/Routing_ML_4/backend/database.py',
          size: 49880,
          functions: 54,
          classes: 0,
          type: 'utility' as const,
        },
        {
          id: 'feature_weights',
          name: 'feature_weights.py',
          path: 'backend/feature_weights.py',
          full_path: '/workspaces/Routing_ML_4/backend/feature_weights.py',
          size: 27911,
          functions: 24,
          classes: 0,
          type: 'utility' as const,
        },
      ];
    } else {
      // AST Analysis and Summary modes: Use all files from API
      return allPythonFiles;
    }
  }, [viewMode, allPythonFiles]);

  // Analyze file and create nodes/edges
  const handleAnalyze = useCallback(async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    try {
      const filePathParam =
        normalizeBackendPath(selectedFile.path) ??
        normalizeBackendPath(selectedFile.full_path) ??
        selectedFile.path ??
        selectedFile.full_path;

      if (!filePathParam) {
        alert('선택한 파일 경로를 확인할 수 없습니다.');
        setIsAnalyzing(false);
        return;
      }

      const response = await axios.get('/api/algorithm-viz/analyze', {
        params: {
          file_path: filePathParam,
        },
      });

      console.log('API Response:', response.data);

      // API already returns nodes in React Flow format
      const apiNodes: Node[] = response.data.nodes;
      const apiEdges: Edge[] = response.data.edges;

      if (!apiNodes || apiNodes.length === 0) {
        alert('이 파일에는 분석할 함수나 클래스가 없습니다.');
        setIsAnalyzing(false);
        return;
      }

      // Convert to our custom node type
      const flowNodes: Node<FunctionNodeData>[] = apiNodes.map((node: any) => ({
        id: node.id,
        type: 'functionNode',
        position: node.position || { x: 0, y: 0 },
        data: {
          label: node.data.label,
          type: node.data.type,
          params: node.data.parameters || [],
          returns: node.data.returnType,
          docstring: node.data.docstring,
          lineStart: node.data.lineStart,
          lineEnd: node.data.lineEnd,
          sourceCode: node.data.sourceCode,
        },
      }));

      // API edges are already in correct format
      const flowEdges: Edge[] = apiEdges.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: 'smoothstep',
        animated: edge.animated || true,
        style: { stroke: '#38bdf8', strokeWidth: 2 },
      }));

      console.log(`Created ${flowNodes.length} nodes and ${flowEdges.length} edges`);

      // Apply dagre layout
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        flowNodes,
        flowEdges
      );

      // Check if there's saved layout in localStorage
      const savedLayout = localStorage.getItem(`layout-${selectedFile.path}`);
      if (savedLayout) {
        try {
          const savedPositions = JSON.parse(savedLayout);
          layoutedNodes.forEach((node) => {
            if (savedPositions[node.id]) {
              node.position = savedPositions[node.id];
            }
          });
        } catch (e) {
          console.warn('Failed to load saved layout:', e);
        }
      }

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      // Auto-scale to fit canvas width with minimal padding
      setTimeout(() => {
        reactFlowInstance?.fitView({ padding: 0.05 });
      }, 100);
    } catch (error: any) {
      console.error('Failed to analyze file:', error);
      alert(`파일 분석 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedFile, reactFlowInstance]);

  // Save layout to localStorage
  const handleSaveLayout = useCallback(() => {
    if (!selectedFile || nodes.length === 0) return;

    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((node) => {
      positions[node.id] = node.position;
    });

    localStorage.setItem(`layout-${selectedFile.path}`, JSON.stringify(positions));
    alert('레이아웃이 저장되었습니다.');
  }, [selectedFile, nodes]);

  // Reset layout to dagre default
  const handleResetLayout = useCallback(() => {
    if (!selectedFile || nodes.length === 0) return;

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    // Remove saved layout
    localStorage.removeItem(`layout-${selectedFile.path}`);

    setTimeout(() => {
      reactFlowInstance?.fitView({ padding: 0.2 });
    }, 0);
  }, [selectedFile, nodes, edges, reactFlowInstance]);

  // Handle node connection
  const handleConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        id: `${connection.source}-${connection.target}`,
        source: connection.source!,
        target: connection.target!,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#38bdf8', strokeWidth: 2 },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    []
  );

  // Node search filter - Fixed: Use useMemo to prevent infinite loop
  // Previous useEffect caused "Maximum update depth exceeded" error
  // by creating new node objects on every setNodes call, triggering ReactFlow's onNodesChange
  const displayNodes = useMemo(() => {
    if (!searchQuery || nodes.length === 0) {
      return nodes;
    }

    const query = searchQuery.toLowerCase();
    return nodes.map((node) => {
      const matches = node.data.label?.toLowerCase().includes(query);
      return {
        ...node,
        style: { ...node.style, opacity: matches ? 1 : 0.3 },
      };
    });
  }, [nodes, searchQuery]);

  // Static mode: Use FLOW_LIBRARY for rainbow balls animation
  const flowDefinition = useMemo(() => {
    if (!selectedFile) return undefined;

    // Try filename first, then ID
    return FLOW_LIBRARY[selectedFile.name] || FLOW_LIBRARY[selectedFile.id] || undefined;
  }, [selectedFile]);

  const staticNodes = useMemo<Node[]>(() => {
    if (viewMode !== 'static' || !flowDefinition) return [];

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
  }, [viewMode, flowDefinition]);

  const staticEdges = useMemo<Edge[]>(() => {
    if (viewMode !== 'static' || !flowDefinition) return [];

    return flowDefinition.edges.map((edge) => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: true,
      style: { strokeWidth: 2, stroke: '#38bdf8' },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 8,
      labelBgStyle: { fill: 'rgba(8, 47, 73, 0.85)', stroke: 'rgba(125, 211, 252, 0.45)' },
      labelStyle: { fill: '#bae6fd', fontSize: 11, fontWeight: 600 },
    }));
  }, [viewMode, flowDefinition]);

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

  const handleFileSelect = (file: PythonFile) => {
    setSelectedFile(file);
    setSelectedFileId(file.id);

    // Clear dynamic nodes when switching files
    if (viewMode === 'dynamic') {
      setNodes([]);
      setEdges([]);
    }

    // In static mode, show nodes immediately
    if (viewMode === 'static') {
      setTimeout(() => {
        reactFlowInstance?.fitView({ padding: 0.2 });
      }, 100);
    }
  };

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
  }, []);

  // Handle node double click to show source code
  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node<FunctionNodeData>) => {
      setModalFileInfo({
        name: node.data.label,
        sourceCode: node.data.sourceCode || '// Source code not available',
        type: node.data.type,
        params: node.data.params,
        returns: node.data.returns,
        docstring: node.data.docstring,
        lineStart: node.data.lineStart,
        lineEnd: node.data.lineEnd,
      });
      setIsModalOpen(true);
    },
    []
  );

  // Handle node changes for dynamic mode
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  // Handle edge changes for dynamic mode
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // Handle summary mode
  const handleSummaryMode = useCallback(async () => {
    setViewMode('summary');
    setIsAnalyzing(true);
    try {
      const response = await axios.get('/api/algorithm-viz/summary');
      const apiNodes: Node[] = response.data.nodes;
      const apiEdges: Edge[] = response.data.edges;

      const summaryNodes: Node[] = apiNodes.map((node: any) => ({
        id: node.id,
        type: 'default',
        position: node.position,
        data: { label: node.data.label, description: node.data.description },
        style: {
          background: node.data.category === 'training'
            ? 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)'
            : node.data.category === 'prediction'
            ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
            : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          border: '2px solid rgba(148, 163, 184, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          color: '#e2e8f0',
          fontSize: '13px',
          fontWeight: 600,
          minWidth: '180px',
        },
      }));

      const summaryEdges: Edge[] = apiEdges.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        animated: true,
        style: { stroke: '#38bdf8', strokeWidth: 2 },
      }));

      setNodes(summaryNodes);
      setEdges(summaryEdges);

      setTimeout(() => {
        reactFlowInstance?.fitView({ padding: 0.3 });
      }, 100);
    } catch (error) {
      console.error('Failed to load project summary:', error);
      alert('프로젝트 Summary 로드 실패');
    } finally {
      setIsAnalyzing(false);
    }
  }, [reactFlowInstance]);

  return (
    <div
      className="algorithm-visualization-workspace flex w-full bg-slate-950"
      style={{ height: 'calc(100vh - 100px)', minHeight: '700px' }}
      data-version="v3.1"
    >
      {/* 좌측 패널: 파일 목록 (20% 너비) */}
      <div className="file-panel w-1/5 min-w-[250px] border-r border-slate-700/50 bg-slate-900/50 p-4 overflow-y-auto flex-shrink-0">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
            <FileCode className="w-4 h-4" />
            Python Files ({displayedFiles.length})
          </h3>
        </div>

        <div className="space-y-2">
          {displayedFiles.map((file) => (
            <button
              key={file.id}
              onClick={() => handleFileSelect(file)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-200
                ${
                  selectedFile?.id === file.id
                    ? 'bg-blue-500/20 border-blue-500/50 shadow-lg shadow-blue-500/20'
                    : `${getFileTypeColor(file.type)} hover:bg-opacity-20`
                }`}
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{file.name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {file.functions}f {file.classes}c
                  </div>
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
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-slate-300">
              {selectedFile ? selectedFile.name : 'Select a file to visualize'}
            </h3>
            {(nodes.length > 0 || staticNodes.length > 0) && (
              <div className="text-xs text-slate-500">
                {viewMode === 'static' ? staticNodes.length : nodes.length} nodes •{' '}
                {viewMode === 'static' ? staticEdges.length : edges.length} edges
              </div>
            )}
            {/* Mode Toggle */}
            <div className="flex gap-1 bg-slate-800/50 border border-slate-700/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode('static')}
                className={`px-3 py-1 text-xs rounded transition-all ${
                  viewMode === 'static'
                    ? 'bg-blue-500/30 text-blue-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                🌈 Rainbow
              </button>
              <button
                onClick={() => setViewMode('dynamic')}
                className={`px-3 py-1 text-xs rounded transition-all ${
                  viewMode === 'dynamic'
                    ? 'bg-emerald-500/30 text-emerald-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                🔬 AST Analysis
              </button>
              <button
                onClick={handleSummaryMode}
                className={`px-3 py-1 text-xs rounded transition-all ${
                  viewMode === 'summary'
                    ? 'bg-purple-500/30 text-purple-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                📊 Summary
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-800/50 border border-slate-700/50 rounded-lg
                       text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 w-48"
            />
            {viewMode === 'dynamic' && (
              <button
                onClick={handleAnalyze}
                disabled={!selectedFile || isAnalyzing}
                className={`px-3 py-1.5 text-sm border rounded-lg transition-colors flex items-center gap-2
                  ${
                    selectedFile && !isAnalyzing
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed'
                  }`}
                title="Run AST analysis on selected Python file"
              >
                <Play className="w-4 h-4" />
                {isAnalyzing ? 'Analyzing...' : 'Analyze'}
              </button>
            )}
            <button
              onClick={handleSaveLayout}
              disabled={nodes.length === 0}
              className={`px-3 py-1.5 text-sm border rounded-lg transition-colors flex items-center gap-2
                ${
                  nodes.length > 0
                    ? 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/50 text-blue-400'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed'
                }`}
              title="Save layout"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={handleResetLayout}
              disabled={nodes.length === 0}
              className={`px-3 py-1.5 text-sm border rounded-lg transition-colors flex items-center gap-2
                ${
                  nodes.length > 0
                    ? 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700/50 text-slate-300'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed'
                }`}
              title="Reset layout"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        {/* 캔버스 영역 */}
        <div className="canvas-container flex-1 relative bg-gradient-to-br from-slate-950 to-slate-900">
          {(viewMode === 'static' && staticNodes.length > 0) || ((viewMode === 'dynamic' || viewMode === 'summary') && nodes.length > 0) ? (
            <ReactFlowProvider>
              <ReactFlow
                nodes={viewMode === 'static' ? staticNodes : displayNodes}
                edges={viewMode === 'static' ? staticEdges : edges}
                onNodesChange={viewMode === 'dynamic' ? handleNodesChange : undefined}
                onEdgesChange={viewMode === 'dynamic' ? handleEdgesChange : undefined}
                onConnect={viewMode === 'dynamic' ? handleConnect : undefined}
                onNodeDoubleClick={handleNodeDoubleClick}
                nodeTypes={nodeTypes}
                connectionMode={ConnectionMode.Loose}
                fitView
                className="h-full"
                onInit={handleInit}
              >
                <Controls position="bottom-right" />
                <Background gap={24} color="#1e293b" />
              </ReactFlow>
            </ReactFlowProvider>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <FileCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">
                  {viewMode === 'static'
                    ? (selectedFile ? 'Rainbow Flow Chart' : 'No File Selected')
                    : (selectedFile ? 'Click "Analyze" to visualize' : 'No File Selected')}
                </p>
                <p className="text-sm">
                  {viewMode === 'static'
                    ? 'Select a Python file from the left panel to see the flow chart'
                    : selectedFile
                    ? 'Click the Analyze button to parse the Python file and generate nodes'
                    : 'Select a Python file from the left panel to get started'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-800/60 bg-slate-900/40 px-6 py-4 text-sm text-slate-300">
          {viewMode === 'static' && selectedFileId && flowDefinition ? (
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
          ) : viewMode === 'dynamic' && nodes.length > 0 ? (
            <>
              <div className="font-semibold text-slate-200 mb-2">Keyboard Shortcuts</div>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 text-xs text-slate-400">
                <div>
                  <span className="text-sky-300">Drag</span> - Move nodes
                </div>
                <div>
                  <span className="text-sky-300">Double Click</span> - View source
                </div>
                <div>
                  <span className="text-sky-300">Port Drag</span> - Connect nodes
                </div>
                <div>
                  <span className="text-sky-300">Delete</span> - Remove edge
                </div>
              </div>
            </>
          ) : (
            <p className="text-slate-400">
              {viewMode === 'static'
                ? '좌측에서 Python 파일을 선택하면 파이프라인 요약과 노드 흐름이 표시됩니다.'
                : '좌측에서 Python 파일을 선택하고 Analyze 버튼을 클릭하여 함수/클래스 노드를 생성하세요.'}
            </p>
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

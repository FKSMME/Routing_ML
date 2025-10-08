/**
 * AlgorithmVisualizationWorkspace
 *
 * Python 알고리즘 시각화 워크스페이스
 * - 좌측: 파일 선택 패널 (20%)
 * - 우측: React Flow 노드 캔버스 (80%)
 *
 * 참고: ALGORITHM_VISUALIZATION_CHECKLIST.md Phase 1
 */

import { CardShell } from "@components/common/CardShell";
import { DialogContainer } from "@components/common/DialogContainer";
import { useCallback, useState, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  type NodeTypes,
  Position,
  ReactFlowProvider,
  NodeProps,
  useNodesState,
  useEdgesState,
  type NodeChange,
  type EdgeChange,
} from "reactflow";
import { FileCode, FileText, Search, AlertCircle } from "lucide-react";
import axios from "axios";
import dagre from "dagre";

// 임시 파일 데이터 (추후 API로 대체)
interface PythonFile {
  id: string;
  name: string;
  path: string;
  type: "training" | "prediction" | "common";
  functions: number;
  classes: number;
}

const MOCK_FILES: PythonFile[] = [
  {
    id: "1",
    name: "trainer.py",
    path: "src/ml/trainer.py",
    type: "training",
    functions: 12,
    classes: 3,
  },
  {
    id: "2",
    name: "predictor.py",
    path: "src/ml/predictor.py",
    type: "prediction",
    functions: 8,
    classes: 2,
  },
  {
    id: "3",
    name: "feature_extractor.py",
    path: "src/ml/feature_extractor.py",
    type: "common",
    functions: 15,
    classes: 4,
  },
  {
    id: "4",
    name: "data_processor.py",
    path: "src/utils/data_processor.py",
    type: "common",
    functions: 20,
    classes: 5,
  },
  {
    id: "5",
    name: "model_manager.py",
    path: "src/ml/model_manager.py",
    type: "training",
    functions: 10,
    classes: 2,
  },
];

// 노드 데이터 타입
interface FunctionNodeData {
  label: string;
  fileName: string;
  type: "function" | "class";
  parameters?: string[];
  returnType?: string;
  docstring?: string;
}

// 커스텀 함수 노드 컴포넌트
function FunctionNode({ data }: NodeProps<FunctionNodeData>) {
  const isFunction = data.type === "function";

  return (
    <div
      className={`
        relative rounded-xl border-2 bg-gradient-to-br p-4 shadow-lg transition-all hover:shadow-xl
        ${
          isFunction
            ? "border-blue-500/50 from-blue-950/80 to-slate-950/90 hover:border-blue-400"
            : "border-green-500/50 from-green-950/80 to-slate-950/90 hover:border-green-400"
        }
      `}
      style={{ width: 280 }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isFunction ? (
            <div className="rounded-lg bg-blue-500/20 p-1.5">
              <FileCode size={16} className="text-blue-400" />
            </div>
          ) : (
            <div className="rounded-lg bg-green-500/20 p-1.5">
              <FileText size={16} className="text-green-400" />
            </div>
          )}
          <span className="text-xs font-bold uppercase tracking-wide text-accent-soft">
            {data.type}
          </span>
        </div>
      </div>
      <h3 className="mt-3 text-base font-bold text-accent-strong">{data.label}</h3>
      <p className="mt-1 text-xs italic text-muted/80">from {data.fileName}</p>

      {data.parameters && data.parameters.length > 0 ? (
        <div className="mt-3 rounded-lg bg-slate-900/50 px-3 py-2">
          <span className="text-xs font-semibold text-accent-soft">Params:</span>
          <div className="mt-1 space-y-1">
            {data.parameters.slice(0, 2).map((param, idx) => (
              <div key={idx} className="truncate text-xs text-muted">
                • {param}
              </div>
            ))}
            {data.parameters.length > 2 && (
              <div className="text-xs text-muted/60">+{data.parameters.length - 2} more</div>
            )}
          </div>
        </div>
      ) : null}

      {data.returnType ? (
        <div className="mt-2 rounded-lg bg-slate-900/50 px-3 py-2">
          <span className="text-xs font-semibold text-accent-soft">Returns: </span>
          <span className="text-xs text-emerald-300">{data.returnType}</span>
        </div>
      ) : null}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  function: FunctionNode,
};

// 임시 노드/엣지 데이터 (추후 AST 파싱 결과로 대체)
const INITIAL_NODES: Node<FunctionNodeData>[] = [
  {
    id: "1",
    type: "function",
    position: { x: 100, y: 100 },
    data: {
      label: "train_model",
      fileName: "trainer.py",
      type: "function",
      parameters: ["X_train", "y_train", "config"],
      returnType: "TrainedModel",
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  {
    id: "2",
    type: "function",
    position: { x: 450, y: 100 },
    data: {
      label: "preprocess_data",
      fileName: "data_processor.py",
      type: "function",
      parameters: ["raw_data", "config"],
      returnType: "ProcessedData",
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
  {
    id: "3",
    type: "function",
    position: { x: 100, y: 300 },
    data: {
      label: "FeatureExtractor",
      fileName: "feature_extractor.py",
      type: "class",
      parameters: ["feature_config"],
      returnType: "None",
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  },
];

const INITIAL_EDGES: Edge[] = [
  {
    id: "e1-2",
    source: "2",
    target: "1",
    animated: true,
    label: "data flow",
    style: { stroke: "#38bdf8", strokeWidth: 2 },
  },
];

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Dagre 자동 레이아웃 함수
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "LR", nodesep: 100, ranksep: 150 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 280, height: 150 });
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
        x: nodeWithPosition.x - 140,
        y: nodeWithPosition.y - 75,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export function AlgorithmVisualizationWorkspace() {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<FunctionNodeData>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDetailDialogOpen, setDetailDialogOpen] = useState(false);

  // API 상태
  const [files, setFiles] = useState<PythonFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 파일 목록 로드
  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get<PythonFile[]>(`${API_BASE_URL}/api/algorithm-viz/files`, {
          params: {
            directory: "backend",
            include_training: true,
            include_prediction: true,
          },
        });
        setFiles(response.data);
      } catch (err) {
        console.error("Failed to load files:", err);
        setError("파일 목록을 불러오지 못했습니다.");
        // Fallback to mock data
        setFiles(MOCK_FILES);
      } finally {
        setLoading(false);
      }
    };
    loadFiles();
  }, []);

  // 노드 위치 localStorage 저장
  useEffect(() => {
    if (selectedFileId && nodes.length > 0) {
      const positions = nodes.map((node) => ({
        id: node.id,
        position: node.position,
      }));
      localStorage.setItem(`node-positions-${selectedFileId}`, JSON.stringify(positions));
    }
  }, [nodes, selectedFileId]);

  // 필터링된 파일 목록
  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 파일 선택 핸들러
  const handleFileClick = useCallback(async (fileId: string) => {
    setSelectedFileId(fileId);
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_BASE_URL}/api/algorithm-viz/analyze`, {
        params: { file_path: fileId },
      });

      const { nodes: apiNodes, edges: apiEdges } = response.data;

      // API 응답을 React Flow 형식으로 변환
      const flowNodes = apiNodes.map((node: any) => ({
        ...node,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      }));

      // 저장된 위치 복원 시도
      const savedPositions = localStorage.getItem(`node-positions-${fileId}`);
      let finalNodes = flowNodes;

      if (savedPositions) {
        const positions = JSON.parse(savedPositions);
        finalNodes = flowNodes.map((node: any) => {
          const saved = positions.find((p: any) => p.id === node.id);
          return saved ? { ...node, position: saved.position } : node;
        });
      } else {
        // 저장된 위치가 없으면 Dagre 레이아웃 적용
        const { nodes: layoutedNodes } = getLayoutedElements(flowNodes, apiEdges);
        finalNodes = layoutedNodes;
      }

      setNodes(finalNodes);
      setEdges(apiEdges);
    } catch (err) {
      console.error("Failed to analyze file:", err);
      setError("파일 분석에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 노드 더블클릭 핸들러
  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node<FunctionNodeData>) => {
      setSelectedNodeId(node.id);
      setDetailDialogOpen(true);
    },
    []
  );

  // 선택된 노드 찾기
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  return (
    <div className="flex h-full gap-6" role="region" aria-label="알고리즘 시각화 워크스페이스">
      {/* 좌측 파일 패널 (20%) */}
      <CardShell
        as="aside"
        tone="soft"
        padding="md"
        className="w-[20%] min-w-[280px]"
        innerClassName="flex h-full flex-col gap-4"
        interactive={false}
      >
        <header className="space-y-2">
          <h2 className="text-lg font-semibold text-accent-strong">Python Files</h2>
          <p className="text-xs text-muted">훈련/예측 알고리즘 파일 목록</p>

          {/* 검색 입력 */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="파일 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-control pl-9 text-sm"
            />
          </div>
        </header>

        {/* 로딩/에러 표시 */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span>로딩 중...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* 파일 목록 */}
        <ul className="flex-1 space-y-2 overflow-y-auto">
          {filteredFiles.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                onClick={() => handleFileClick(file.id)}
                disabled={loading}
                className={`
                  w-full rounded-xl border px-4 py-3 text-left transition
                  ${
                    selectedFileId === file.id
                      ? "border-accent bg-accent/10 text-accent-strong"
                      : "border-soft surface-card hover:border-accent-soft hover:text-accent"
                  }
                  ${loading ? "cursor-not-allowed opacity-50" : ""}
                `}
              >
                <div className="flex items-center gap-2">
                  <FileCode size={16} className="text-accent-soft" />
                  <h3 className="text-sm font-semibold">{file.name}</h3>
                </div>
                <p className="mt-1 truncate text-xs text-muted" title={file.path}>
                  {file.path}
                </p>
                <div className="mt-2 flex gap-3 text-xs text-muted">
                  <span>Functions: {file.functions}</span>
                  <span>Classes: {file.classes}</span>
                </div>
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    file.type === "training"
                      ? "bg-blue-500/20 text-blue-300"
                      : file.type === "prediction"
                        ? "bg-green-500/20 text-green-300"
                        : "bg-purple-500/20 text-purple-300"
                  }`}
                >
                  {file.type}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CardShell>

      {/* 우측 캔버스 영역 (80%) */}
      <section className="relative flex-1 overflow-hidden rounded-3xl border border-soft surface-card-overlay shadow-elevated">
        <div className="canvas-panel" aria-hidden="true" />

        <ReactFlowProvider>
          <ReactFlow
            nodeTypes={nodeTypes}
            nodes={nodes}
            edges={edges}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            className="rounded-3xl"
          >
            <MiniMap pannable zoomable />
            <Controls />
            <Background gap={24} color="#1e293b" />
          </ReactFlow>
        </ReactFlowProvider>

        {/* 상단 툴바 */}
        <div className="absolute left-4 top-4 z-10 flex gap-3 rounded-xl border border-soft bg-slate-900/80 px-4 py-2 backdrop-blur-sm">
          <span className="text-sm text-muted">
            {selectedFileId
              ? `현재 파일: ${MOCK_FILES.find((f) => f.id === selectedFileId)?.name ?? "없음"}`
              : "파일을 선택하세요"}
          </span>
        </div>
      </section>

      {/* 노드 상세 정보 다이얼로그 */}
      {selectedNode && isDetailDialogOpen ? (
        <DialogContainer
          role="dialog"
          aria-modal="true"
          aria-labelledby="node-detail-dialog"
          className="z-50"
          surfaceClassName="flex max-h-[80vh] flex-col gap-6"
          maxWidth={800}
        >
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-accent-soft/80">
                {selectedNode.data.type}
              </p>
              <h2 id="node-detail-dialog" className="text-2xl font-semibold text-accent-strong">
                {selectedNode.data.label}
              </h2>
              <p className="mt-1 text-sm text-muted">from {selectedNode.data.fileName}</p>
            </div>
            <button
              type="button"
              onClick={() => setDetailDialogOpen(false)}
              className="btn-secondary"
            >
              닫기
            </button>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto pr-2">
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-accent-strong">함수 정보</h3>

              {selectedNode.data.parameters && selectedNode.data.parameters.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-muted-strong">Parameters</h4>
                  <ul className="space-y-1 text-sm text-muted">
                    {selectedNode.data.parameters.map((param, idx) => (
                      <li key={idx} className="rounded bg-slate-800/50 px-3 py-1">
                        • {param}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {selectedNode.data.returnType ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-muted-strong">Return Type</h4>
                  <p className="rounded bg-slate-800/50 px-3 py-2 text-sm text-muted">
                    {selectedNode.data.returnType}
                  </p>
                </div>
              ) : null}

              {selectedNode.data.docstring ? (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-muted-strong">Docstring</h4>
                  <p className="whitespace-pre-wrap rounded bg-slate-800/50 px-3 py-2 text-sm text-muted">
                    {selectedNode.data.docstring}
                  </p>
                </div>
              ) : (
                <p className="text-sm italic text-muted">Docstring이 없습니다.</p>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-accent-strong">소스 코드</h3>
              <div className="rounded-lg bg-slate-950 p-4">
                <code className="block overflow-x-auto text-xs text-slate-300">
                  {`# TODO: 실제 소스 코드를 여기에 표시
def ${selectedNode.data.label}(${selectedNode.data.parameters?.join(", ") ?? ""}):
    """함수 구현 내용"""
    pass`}
                </code>
              </div>
              <button type="button" className="btn-secondary w-full">
                코드로 이동 (VS Code)
              </button>
            </section>
          </div>

          <footer className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDetailDialogOpen(false)}
              className="btn-primary"
            >
              확인
            </button>
          </footer>
        </DialogContainer>
      ) : null}
    </div>
  );
}

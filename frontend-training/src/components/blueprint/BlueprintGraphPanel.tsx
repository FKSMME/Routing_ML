import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type OnConnect,
  type Node,
  type Edge,
  type FitViewOptions,
} from '@xyflow/react';
import dagre from 'dagre';
import { BlueprintNode, type BlueprintNodeData } from './BlueprintNode';
import './blueprint.css';

const nodeTypes = {
  blueprint: BlueprintNode,
};

const fitViewOptions: FitViewOptions = {
  padding: 0.2,
};

// Define predictor workflow based on ML algorithm analysis
const initialNodes: Node<BlueprintNodeData>[] = [
  {
    id: '1',
    type: 'blueprint',
    position: { x: 0, y: 0 },
    data: {
      label: '품목 코드 입력',
      type: 'data_input',
      description: 'item_codes: List[str]',
      parameters: {
        item_codes: [],
        top_k: 10,
        threshold: 0.5,
      },
    },
  },
  {
    id: '2',
    type: 'blueprint',
    position: { x: 0, y: 0 },
    data: {
      label: '모델 로드',
      type: 'model_persistence',
      description: 'HNSW 인덱스 + 메타데이터',
      parameters: {
        model_path: 'models/hnsw_index.bin',
      },
    },
  },
  {
    id: '3',
    type: 'blueprint',
    position: { x: 0, y: 0 },
    data: {
      label: '캐시 확인',
      type: 'cache',
      description: 'LRU 캐시에서 결과 조회',
      parameters: {
        cache_size: 1000,
      },
    },
  },
  {
    id: '4',
    type: 'blueprint',
    position: { x: 0, y: 0 },
    data: {
      label: '유사 품목 검색',
      type: 'model_inference',
      description: 'HNSW kNN 검색',
      parameters: {
        ef_search: 50,
      },
    },
  },
  {
    id: '5',
    type: 'blueprint',
    position: { x: 0, y: 0 },
    data: {
      label: '피처 가중치 적용',
      type: 'feature_engineering',
      description: '사용자 정의 가중치 반영',
      parameters: {
        profile: 'default',
      },
    },
  },
  {
    id: '6',
    type: 'blueprint',
    position: { x: 0, y: 0 },
    data: {
      label: '통계 분석',
      type: 'statistical_analysis',
      description: '신뢰도 구간 계산',
      parameters: {
        confidence_level: 0.95,
      },
    },
  },
  {
    id: '7',
    type: 'blueprint',
    position: { x: 0, y: 0 },
    data: {
      label: '결과 검증',
      type: 'validation',
      description: 'threshold 필터링',
      parameters: {
        min_similarity: 0.5,
      },
    },
  },
  {
    id: '8',
    type: 'blueprint',
    position: { x: 0, y: 0 },
    data: {
      label: '라우팅 출력',
      type: 'output',
      description: 'JSON + 시각화 데이터',
      parameters: {
        format: 'json',
        include_viz: true,
      },
    },
  },
];

const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    type: 'smoothstep',
    animated: true,
    className: 'edge-data-flow',
  },
  {
    id: 'e2-3',
    source: '2',
    target: '3',
    type: 'smoothstep',
    className: 'edge-control-flow',
  },
  {
    id: 'e3-4',
    source: '3',
    target: '4',
    type: 'smoothstep',
    animated: true,
    className: 'edge-data-flow',
    label: 'cache miss',
  },
  {
    id: 'e3-8',
    source: '3',
    target: '8',
    type: 'smoothstep',
    className: 'edge-optional',
    label: 'cache hit',
  },
  {
    id: 'e4-5',
    source: '4',
    target: '5',
    type: 'smoothstep',
    animated: true,
    className: 'edge-data-flow',
  },
  {
    id: 'e5-6',
    source: '5',
    target: '6',
    type: 'smoothstep',
    animated: true,
    className: 'edge-data-flow',
  },
  {
    id: 'e6-7',
    source: '6',
    target: '7',
    type: 'smoothstep',
    className: 'edge-control-flow',
  },
  {
    id: 'e7-8',
    source: '7',
    target: '8',
    type: 'smoothstep',
    animated: true,
    className: 'edge-data-flow',
  },
];

// Auto-layout using dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 120 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 220, height: 120 });
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
        x: nodeWithPosition.x - 110,
        y: nodeWithPosition.y - 60,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
  initialNodes,
  initialEdges
);

export function BlueprintGraphPanel() {
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const nodeColor = (node: Node<BlueprintNodeData>) => {
    switch (node.data.type) {
      case 'data_input':
        return '#4A90E2';
      case 'preprocessing':
        return '#F5A623';
      case 'feature_engineering':
        return '#7ED321';
      case 'model_inference':
        return '#BD10E0';
      case 'model_training':
        return '#D0021B';
      case 'statistical_analysis':
        return '#50E3C2';
      case 'validation':
        return '#F8E71C';
      case 'model_persistence':
        return '#9013FE';
      case 'output':
        return '#417505';
      case 'cache':
        return '#8B572A';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="surface-card rounded-lg overflow-hidden" style={{ height: '600px' }}>
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">
          예측 알고리즘 블루프린트
        </h3>
        <p className="text-sm text-muted mt-1">
          HNSW 기반 유사 품목 검색 워크플로우
        </p>
      </div>
      <div className="blueprint-graph" style={{ height: 'calc(100% - 76px)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={fitViewOptions}
          attributionPosition="bottom-left"
        >
          <Background gap={16} size={1} />
          <Controls />
          <MiniMap nodeColor={nodeColor} zoomable pannable />
        </ReactFlow>
      </div>
    </div>
  );
}

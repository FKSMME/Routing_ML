import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface CodeStructure {
  nodes: Array<{
    id: string;
    name: string;
    module: string;
    file_path: string;
    line_number: number;
    doc?: string;
    args: string[];
    returns?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    call_type: string;
  }>;
  entry_points: string[];
}

interface AlgorithmVisualizationProps {
  module?: 'all' | 'training' | 'prediction' | 'database';
  apiBaseUrl?: string;
}

const nodeColors = {
  training: '#667eea',
  prediction: '#f093fb',
  database: '#4facfe',
};

export function AlgorithmVisualization({
  module = 'all',
  apiBaseUrl = '/api'
}: AlgorithmVisualizationProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  useEffect(() => {
    loadCodeStructure();
  }, [module]);

  const loadCodeStructure = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/blueprint/structure?module=${module}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to load code structure');
      }

      const data: CodeStructure = await response.json();

      // Convert to React Flow format
      const flowNodes: Node[] = data.nodes.map((node, index) => {
        const moduleType = node.module as keyof typeof nodeColors;
        const color = nodeColors[moduleType] || '#6b7280';

        return {
          id: node.id,
          type: 'default',
          data: {
            label: (
              <div className="node-content">
                <div className="node-name">{node.name}</div>
                <div className="node-module">{node.module}</div>
                {node.args.length > 0 && (
                  <div className="node-args">({node.args.join(', ')})</div>
                )}
              </div>
            ),
            ...node,
          },
          position: {
            x: (index % 5) * 250,
            y: Math.floor(index / 5) * 150,
          },
          style: {
            background: color,
            color: 'white',
            border: data.entry_points.includes(node.id) ? '3px solid #fbbf24' : 'none',
            borderRadius: '8px',
            padding: '10px',
            minWidth: '200px',
          },
        };
      });

      const flowEdges: Edge[] = data.edges.map((edge, index) => ({
        id: `e${index}-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: edge.call_type === 'async' ? 'smoothstep' : 'default',
        animated: edge.call_type === 'async',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
        style: {
          stroke: edge.call_type === 'conditional' ? '#fbbf24' : '#6b7280',
          strokeWidth: 2,
        },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to load code structure:', err);
    } finally {
      setLoading(false);
    }
  };

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.data);
  }, []);

  return (
    <div className="algorithm-visualization">
      <div className="visualization-header">
        <h2>알고리즘 실시간 시각화</h2>
        <div className="visualization-controls">
          <select
            value={module}
            onChange={(e) => loadCodeStructure()}
            className="module-selector"
          >
            <option value="all">전체</option>
            <option value="training">훈련</option>
            <option value="prediction">예측</option>
            <option value="database">데이터베이스</option>
          </select>
          <button onClick={loadCodeStructure} className="btn-refresh">
            새로고침
          </button>
        </div>
      </div>

      <div className="visualization-container">
        {loading && (
          <div className="visualization-overlay">
            <div className="spinner"></div>
            <p>코드 구조 분석 중...</p>
          </div>
        )}

        {error && (
          <div className="visualization-error">
            오류: {error}
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
          attributionPosition="bottom-right"
        >
          <Controls />
          <MiniMap />
          <Background variant="dots" gap={12} size={1} />
        </ReactFlow>
      </div>

      {selectedNode && (
        <div className="node-details">
          <h3>{selectedNode.name}</h3>
          <div className="detail-row">
            <span className="detail-label">모듈:</span>
            <span className="detail-value">{selectedNode.module}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">파일:</span>
            <span className="detail-value">{selectedNode.file_path}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">라인:</span>
            <span className="detail-value">{selectedNode.line_number}</span>
          </div>
          {selectedNode.doc && (
            <div className="detail-row">
              <span className="detail-label">설명:</span>
              <span className="detail-value">{selectedNode.doc}</span>
            </div>
          )}
          {selectedNode.args && selectedNode.args.length > 0 && (
            <div className="detail-row">
              <span className="detail-label">인자:</span>
              <span className="detail-value">{selectedNode.args.join(', ')}</span>
            </div>
          )}
          {selectedNode.returns && (
            <div className="detail-row">
              <span className="detail-label">반환:</span>
              <span className="detail-value">{selectedNode.returns}</span>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .algorithm-visualization {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .visualization-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .visualization-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }

        .visualization-controls {
          display: flex;
          gap: 0.5rem;
        }

        .module-selector {
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          border: none;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .module-selector option {
          background: #667eea;
        }

        .btn-refresh {
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          border: none;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-refresh:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .visualization-container {
          flex: 1;
          position: relative;
          background: #f9fafb;
        }

        .visualization-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #f3f4f6;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .visualization-error {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          padding: 1rem 2rem;
          background: #fee2e2;
          color: #dc2626;
          border-radius: 0.5rem;
          z-index: 1000;
        }

        .node-details {
          position: absolute;
          top: 1rem;
          right: 1rem;
          width: 300px;
          background: white;
          border-radius: 0.5rem;
          padding: 1rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 100;
        }

        .node-details h3 {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
          color: #667eea;
        }

        .detail-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }

        .detail-label {
          font-weight: 600;
          color: #6b7280;
          min-width: 60px;
        }

        .detail-value {
          color: #1f2937;
          flex: 1;
        }

        .node-content {
          text-align: center;
        }

        .node-name {
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .node-module {
          font-size: 0.75rem;
          opacity: 0.8;
        }

        .node-args {
          font-size: 0.75rem;
          margin-top: 0.25rem;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}

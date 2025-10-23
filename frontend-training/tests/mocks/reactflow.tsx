import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

export const Background = () => null;
export const Controls = () => null;
export const MiniMap = () => null;
export const Position = { Right: "right", Left: "left" } as const;

export const useEdgesState = () => [[], () => undefined, () => undefined] as const;
export const useNodesState = () => [[], () => undefined, () => undefined] as const;

type ReactFlowProps = {
  children?: ReactNode;
  nodes?: unknown[];
  onInit?: (instance: Record<string, never>) => void;
  onNodeClick?: (event: unknown, node: unknown) => void;
};

const ReactFlow = ({ children, nodes = [], onInit, onNodeClick }: ReactFlowProps) => {
  const hasSelectedRef = useRef(false);

  useEffect(() => {
    if (onInit) {
      onInit({} as Record<string, never>);
    }
  }, [onInit]);

  useEffect(() => {
    if (!hasSelectedRef.current && nodes.length > 0 && onNodeClick) {
      hasSelectedRef.current = true;
      onNodeClick({}, nodes[0]);
    }
  }, [nodes, onNodeClick]);

  return <div data-testid="reactflow-mock">{children}</div>;
};

export const ReactFlowProvider = ({ children }: { children?: ReactNode }) => <>{children}</>;

export default ReactFlow;

import { fireEvent, render, screen, waitFor } from "../../frontend/node_modules/@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("reactflow", async () => {
  const React = await import("react");
  const ReactFlow = ({ children, onInit }: React.PropsWithChildren<{ onInit?: (instance: unknown) => void }>) => {
    React.useEffect(() => {
      if (onInit) {
        onInit({
          fitView: () => undefined,
          project: ({ x, y }: { x: number; y: number }) => ({ x, y }),
        });
      }
    }, [onInit]);
    return <div data-testid="mock-reactflow">{children}</div>;
  };
  const useNodesState = (initial: unknown[]) => {
    const [nodes, setNodes] = React.useState(initial);
    const onNodesChange = React.useCallback(() => undefined, []);
    return [nodes, setNodes, onNodesChange] as const;
  };
  const useEdgesState = (initial: unknown[]) => {
    const [edges, setEdges] = React.useState(initial);
    const onEdgesChange = React.useCallback(() => undefined, []);
    return [edges, setEdges, onEdgesChange] as const;
  };
  const Provider = ({ children }: React.PropsWithChildren) => <>{children}</>;
  const VoidComponent = () => null;
  return {
    __esModule: true,
    default: ReactFlow,
    ReactFlowProvider: Provider,
    MiniMap: VoidComponent,
    Controls: VoidComponent,
    Background: VoidComponent,
    useNodesState,
    useEdgesState,
  };
});

import { CandidatePanel } from "../../frontend/src/components/CandidatePanel";
import { RoutingCanvas } from "../../frontend/src/components/routing/RoutingCanvas";
import type { OperationStep } from "../../frontend/src/types/routing";
import { useRoutingStore } from "../../frontend/src/store/routingStore";

describe("Routing drag and drop integration", () => {
  const baseState = useRoutingStore.getState();

  const resetStore = () => {
    useRoutingStore.setState(
      () => ({
        ...baseState,
        loading: false,
        saving: false,
        dirty: false,
        erpRequired: false,
        activeItemId: null,
        activeProductId: null,
        activeGroupId: null,
        activeGroupName: null,
        activeGroupVersion: undefined,
        lastSavedAt: undefined,
        productTabs: [],
        recommendations: [],
        timeline: [],
        history: { past: [], future: [] },
        lastSuccessfulTimeline: {},
        validationErrors: [],
        sourceItemCodes: [],
      }),
      true,
    );
  };

  beforeEach(() => {
    resetStore();
  });

  it("adds a candidate block to the timeline when dropped", async () => {
    const operation: OperationStep = {
      PROC_SEQ: 1,
      PROC_CD: "CUT-100",
      PROC_DESC: "절단 공정",
      SETUP_TIME: 5,
      RUN_TIME: 15,
      WAIT_TIME: 2,
    };

    useRoutingStore.setState((state) => ({
      ...state,
      activeProductId: "ITEM-100",
      activeItemId: "ITEM-100",
      recommendations: [
        { itemCode: "ITEM-100", candidateId: "cand-1", operations: [operation] },
      ],
      productTabs: [
        {
          id: "ITEM-100",
          productCode: "ITEM-100",
          productName: "ITEM-100",
          candidateId: "cand-1",
          timeline: [],
        },
      ],
      timeline: [],
      lastSuccessfulTimeline: { "ITEM-100": [] },
      sourceItemCodes: ["ITEM-100"],
    }));

    render(
      <div className="dnd-test-container">
        <CandidatePanel />
        <RoutingCanvas />
      </div>,
    );

    const candidateCard = await screen.findByText("CUT-100");
    const draggableItem = candidateCard.closest("[draggable='true']") as HTMLElement;

    const dataStore: Record<string, string> = {};
    const dataTransfer = {
      dataStore,
      dropEffect: "none",
      effectAllowed: "none",
      files: [],
      items: [],
      types: [],
      setData: vi.fn((type: string, value: string) => {
        dataStore[type] = value;
      }),
      getData: vi.fn((type: string) => dataStore[type] ?? ""),
      clearData: vi.fn(),
      setDragImage: vi.fn(),
    } as unknown as DataTransfer;

    fireEvent.dragStart(draggableItem, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      "application/routing-operation",
      expect.stringContaining("CUT-100"),
    );

    const dropZone = document.querySelector(".timeline-flow") as HTMLDivElement;
    expect(dropZone).not.toBeNull();

    vi.spyOn(dropZone, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 200,
      right: 600,
      width: 600,
      height: 200,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.dragOver(dropZone, { dataTransfer });
    fireEvent.drop(dropZone, { dataTransfer, clientX: 120, clientY: 40 });

    await waitFor(() => {
      const timeline = useRoutingStore.getState().timeline;
      expect(timeline).toHaveLength(1);
      expect(timeline[0].processCode).toBe("CUT-100");
    });

    expect(useRoutingStore.getState().dirty).toBe(true);
  });
});

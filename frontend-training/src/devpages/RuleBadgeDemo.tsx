import { useEffect } from "react";

import { RoutingCanvas } from "@components/routing/RoutingCanvas";
import { useRoutingStore } from "@store/routingStore";

export function RuleBadgeDemo() {
  useEffect(() => {
    useRoutingStore.setState((state) => ({
      ...state,
      activeProductId: "ITEM-900",
      activeItemId: "ITEM-900",
      productTabs: [
        {
          id: "ITEM-900",
          productCode: "ITEM-900",
          productName: "Rule Badge Demo",
          candidateId: "cand-demo",
          timeline: [],
        },
      ],
      timeline: [
        {
          id: "demo-step-1",
          seq: 1,
          processCode: "CUT-900",
          description: "Demo cutting operation",
          setupTime: 4,
          runTime: 14,
          waitTime: 2,
          itemCode: "ITEM-900",
          candidateId: "cand-demo",
          positionX: 0,
          violations: [
            {
              ruleId: "DSL-R001",
              message: "첫 공정은 LOADER 이어야 합니다.",
              severity: "error",
            },
          ],
        },
        {
          id: "demo-step-2",
          seq: 2,
          processCode: "LOAD-910",
          description: "Secondary load",
          setupTime: 2,
          runTime: 8,
          waitTime: 1,
          itemCode: "ITEM-900",
          candidateId: "cand-demo",
          positionX: 240,
          violations: [
            {
              ruleId: "DSL-W002",
              message: "대기 시간은 5분 이상 확보하세요.",
              severity: "warning",
            },
          ],
        },
      ],
    }));
  }, []);

  return (
    <main className="demo-shell">
      <header className="demo-shell__header">
        <h1>Routing DSL Rule Badge Demo</h1>
        <p>ReactFlow 타임라인에서 DSL 규칙 위반 뱃지 렌더링을 확인합니다.</p>
      </header>
      <section className="demo-shell__canvas">
        <RoutingCanvas autoFit={false} />
      </section>
    </main>
  );
}

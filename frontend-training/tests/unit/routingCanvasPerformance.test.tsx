import fs from "node:fs";
import path from "node:path";

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Profiler } from "react";

import { RoutingCanvas, type RoutingCanvasProfileController } from "@components/routing/RoutingCanvas";
import { useRoutingStore, type TimelineStep } from "@store/routingStore";

describe("RoutingCanvas drag performance", () => {
  const baseState = useRoutingStore.getState();

  beforeAll(() => {
    if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
      class StubObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      // @ts-expect-error - jsdom environment lacks ResizeObserver by default
      window.ResizeObserver = StubObserver;
    }

    if (!globalThis.requestAnimationFrame) {
      const now =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? () => performance.now()
          : () => Date.now();
      globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
        return setTimeout(() => callback(now()), 16) as unknown as number;
      };
    }

    if (!globalThis.cancelAnimationFrame) {
      globalThis.cancelAnimationFrame = (handle: number) => clearTimeout(handle);
    }
  });

  afterEach(() => {
    cleanup();
    useRoutingStore.setState(() => baseState, true);
  });

  it("records frame timings while moving 100 nodes", async () => {
    const stepCount = 100;
    const steps: TimelineStep[] = Array.from({ length: stepCount }, (_unused, index) => ({
      id: `step-${index}`,
      seq: index + 1,
      processCode: `PROC-${index.toString().padStart(3, "0")}`,
      description: `Profiling operation ${index}`,
      setupTime: 5,
      runTime: 12,
      waitTime: 3,
      itemCode: "PROFILER-ITEM",
      candidateId: "PROFILER-CANDIDATE",
      positionX: index * 240,
    }));

    useRoutingStore.setState(
      () => ({
        ...baseState,
        activeProductId: "PROFILER",
        activeItemId: "PROFILER",
        timeline: steps,
        productTabs: [
          {
            id: "PROFILER",
            productCode: "PROFILER",
            productName: "Profiler",
            candidateId: "PROFILER-CANDIDATE",
            timeline: steps,
          },
        ],
        history: { past: [], future: [] },
        lastSuccessfulTimeline: { PROFILER: steps },
        dirty: false,
      }),
      true,
    );

    const commitDurations: number[] = [];

    const controller = await new Promise<RoutingCanvasProfileController>((resolve) => {
      render(
        <Profiler
          id="routing-canvas"
          onRender={(_id, phase, actualDuration) => {
            if (phase === "update") {
              commitDurations.push(actualDuration);
            }
          }}
        >
          <RoutingCanvas autoFit={false} onProfileReady={resolve} />
        </Profiler>,
      );
    });

    for (let index = 0; index < stepCount; index += 1) {
      const targetX = (stepCount - index - 1) * 240;
      const targetY = (index % 10) * 32;
      // Move each node to a mirrored position to simulate dragging across the canvas
      await act(async () => {
        controller.moveNode(`step-${index}`, { x: targetX, y: targetY });
        await Promise.resolve();
      });
    }

    expect(commitDurations.length).toBeGreaterThanOrEqual(stepCount);

    const totalDuration = commitDurations.reduce((acc, value) => acc + value, 0);
    const maxDuration = commitDurations.reduce((acc, value) => Math.max(acc, value), 0);
    const averageDuration = totalDuration / commitDurations.length;
    const framesOverBudget = commitDurations.filter((value) => value > 16).length;

    const result = {
      timestamp: new Date().toISOString(),
      totalCommits: commitDurations.length,
      stepCount,
      averageFrameMs: Number(averageDuration.toFixed(3)),
      maxFrameMs: Number(maxDuration.toFixed(3)),
      framesOver16ms: framesOverBudget,
      targetMet: framesOverBudget === 0,
    };

    const outputDir = path.resolve(__dirname, "../../..", "deliverables/2025-09-29");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "routing_canvas_profile.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");

    const csvHeader = "timestamp,total_commits,step_count,average_frame_ms,max_frame_ms,frames_over_16ms,target_met";
    const csvRow = [
      result.timestamp,
      result.totalCommits,
      result.stepCount,
      result.averageFrameMs,
      result.maxFrameMs,
      result.framesOver16ms,
      result.targetMet,
    ].join(",");
    fs.writeFileSync(
      path.join(outputDir, "frontend_reactflow_testcases.csv"),
      `${csvHeader}\n${csvRow}\n`,
      "utf8",
    );

    expect(result.maxFrameMs).toBeGreaterThan(0);
  }, 20000);
});

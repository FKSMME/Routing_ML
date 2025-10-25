import type { TensorboardMetricSeries } from "@app-types/tensorboard";
import { exportTensorboardProjector, fetchTensorboardConfig, fetchTrainingStatus } from "@lib/apiClient";
import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useTensorboardStore } from "@store/tensorboardStore";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type VisualizationMode = '3d' | 'heatmap' | 'tsne';

const COLOR_PALETTE = [
  "#60a5fa",
  "#a855f7",
  "#34d399",
  "#f59e0b",
  "#f97316",
  "#f43f5e",
  "#8b5cf6",
  "#14b8a6",
  "#ef4444",
  "#6366f1",
];

const stepColor = (step: number): string => {
  if (step <= 0) {
    return "#94a3b8";
  }
  return COLOR_PALETTE[(step - 1) % COLOR_PALETTE.length] ?? COLOR_PALETTE[0];
};

const hexToRGB = (hex: string): [number, number, number] => {
  const cleanHex = hex.replace("#", "");
  const bigint = Number.parseInt(cleanHex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r / 255, g / 255, b / 255];
};

const HEATMAP_CELL_SIZE = 1.6;
const HEATMAP_HEIGHT_SCALE = 2.4;
const HEATMAP_NEGATIVE = new THREE.Color("#2563eb");
const HEATMAP_ZERO = new THREE.Color("#e2e8f0");
const HEATMAP_POSITIVE = new THREE.Color("#ef4444");

type \uc5f4\ub839\ub9f5Cell = {
  key: string;
  row: number;
  col: number;
  value: number;
  height: number;
  color: string;
  position: [number, number, number];
  rowLabel: string;
  colLabel: string;
};

const correlationToColor = (value: number): string => {
  const clamped = Math.max(-1, Math.min(1, value));
  const base =
    clamped >= 0
      ? HEATMAP_ZERO.clone().lerp(HEATMAP_POSITIVE, clamped)
      : HEATMAP_ZERO.clone().lerp(HEATMAP_NEGATIVE, Math.abs(clamped));
  return `#${base.getHexString()}`;
};

const FEATURE_AXIS_RANGE = 6;
const MAX_CLUSTER_SAMPLE = 4000;
const KMEANS_MAX_ITERATIONS = 20;

type AxisMapping = {
  x: string | null;
  y: string | null;
  z: string | null;
};

type NumericFieldStat = {
  name: string;
  min: number;
  max: number;
  count: number;
};

const normalizeToRange = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return 0;
  }
  if (max <= min) {
    return 0;
  }
  return (value - min) / (max - min) * 2 - 1;
};

const computeKMeansAssignments = (
  positions: Float32Array,
  pointCount: number,
  clusterCount: number
): number[] | null => {
  if (clusterCount < 2 || pointCount === 0 || positions.length < pointCount * 3) {
    return null;
  }
  const stride = Math.max(1, Math.floor(pointCount / MAX_CLUSTER_SAMPLE));
  const sampleIndices: number[] = [];
  for (let index = 0; index < pointCount; index += stride) {
    sampleIndices.push(index);
  }
  if (sampleIndices.length < clusterCount) {
    return null;
  }
  const centroids: Array<Float32Array> = new Array(clusterCount).fill(0).map(() => new Float32Array(3));
  const step = Math.max(1, Math.floor(sampleIndices.length / clusterCount));
  for (let c = 0; c < clusterCount; c += 1) {
    const sampleIndex = sampleIndices[Math.min(c * step, sampleIndices.length - 1)];
    const base = sampleIndex * 3;
    centroids[c][0] = positions[base];
    centroids[c][1] = positions[base + 1];
    centroids[c][2] = positions[base + 2];
  }
  const sampleAssignments = new Array(sampleIndices.length).fill(0);
  const sums: Array<Float64Array> = new Array(clusterCount).fill(0).map(() => new Float64Array(3));
  for (let iteration = 0; iteration < KMEANS_MAX_ITERATIONS; iteration += 1) {
    let moved = false;
    const counts = new Array(clusterCount).fill(0);
    for (let c = 0; c < clusterCount; c += 1) {
      sums[c][0] = 0;
      sums[c][1] = 0;
      sums[c][2] = 0;
    }
    for (let sIdx = 0; sIdx < sampleIndices.length; sIdx += 1) {
      const index = sampleIndices[sIdx];
      const base = index * 3;
      let bestCluster = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let c = 0; c < clusterCount; c += 1) {
        const dx = positions[base] - centroids[c][0];
        const dy = positions[base + 1] - centroids[c][1];
        const dz = positions[base + 2] - centroids[c][2];
        const dist = dx * dx + dy * dy + dz * dz;
        if (dist < bestDist) {
          bestDist = dist;
          bestCluster = c;
        }
      }
      if (sampleAssignments[sIdx] !== bestCluster) {
        sampleAssignments[sIdx] = bestCluster;
        moved = true;
      }
      counts[bestCluster] += 1;
      sums[bestCluster][0] += positions[base];
      sums[bestCluster][1] += positions[base + 1];
      sums[bestCluster][2] += positions[base + 2];
    }
    for (let c = 0; c < clusterCount; c += 1) {
      if (counts[c] === 0) {
        const randomIndex = sampleIndices[Math.floor(Math.random() * sampleIndices.length)];
        const base = randomIndex * 3;
        centroids[c][0] = positions[base];
        centroids[c][1] = positions[base + 1];
        centroids[c][2] = positions[base + 2];
        continue;
      }
      centroids[c][0] = sums[c][0] / counts[c];
      centroids[c][1] = sums[c][1] / counts[c];
      centroids[c][2] = sums[c][2] / counts[c];
    }
    if (!moved && iteration > 0) {
      break;
    }
  }
  const assignments = new Array(pointCount).fill(0);
  for (let index = 0; index < pointCount; index += 1) {
    const base = index * 3;
    let bestCluster = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let c = 0; c < clusterCount; c += 1) {
      const dx = positions[base] - centroids[c][0];
      const dy = positions[base + 1] - centroids[c][1];
      const dz = positions[base + 2] - centroids[c][2];
      const dist = dx * dx + dy * dy + dz * dz;
      if (dist < bestDist) {
        bestDist = dist;
        bestCluster = c;
      }
    }
    assignments[index] = bestCluster;
  }
  return assignments;
};

const HEATMAP_EMPTY_MESSAGE = "\uD3EC\uC778\uD2B8 \uD1B5\uACC4 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. 3D \uC2DC\uAC01\uD654\uB97C \uC704\uD574 \uB370\uC774\uD130\uB97C \uB0B4\uBCF4\uB0B4\uC138\uC694.";
const HEATMAP_INFO_DESCRIPTION = "\uB9C9\uB300\uC758 \uC0C9\uC0C1\uC740 \uC0C1\uAD00\uACC4\uC218 \uBD80\uD638\uB97C, \uB192\uC774\uB294 \uC808\uB300\uAC12 \uD06C\uAE30\uB97C \uB73B\uD569\uB2C8\uB2E4. \uB9C9\uB300\uB97C hover \uD574\uC11C \uC790\uC138\uD55C \uC0C1\uAD00\uAC12\uC744 \uD655\uC778\uD558\uC138\uC694.";
const HEATMAP_LEGEND_DESCRIPTION = "\uC0C9\uC740 \uC0C1\uAD00\uACC4\uC218\uC758 \uBD80\uD638\uB97C, \uB192\uC774\uB294 \uC808\uB300\uAC12(\uAC15\uB3C4)\uB97C \uB098\uD0C0\uB0B5\uB2C8\uB2E4.";
const HEATMAP_AXIS_SUFFIX = "\uCD95";

const MetricChart = ({ series }: { series: TensorboardMetricSeries }) => {
  const option = useMemo<EChartsOption>(() => {
    if (series.points.length === 0) {
      return {
        title: {
          text: series.metric,
          left: "center",
          textStyle: { color: "#64748b", fontSize: 12 },
        },
        graphic: {
          type: "text",
          left: "center",
          top: "middle",
          style: {
            text: "\ud45c\uc2dc\ud560 \uc9c0\ud45c \ub370\uc774\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.",
            fill: "#94a3b8",
            fontSize: 13,
          },
        },
      };
    }

    const steps = series.points.map((point) => point.step);
    const values = series.points.map((point) => point.value);
    const timestamps = series.points.map((point) => point.timestamp ?? "");
    const latestValue = values.at(-1) ?? 0;
    const latestStep = steps.at(-1) ?? 0;

    return {
      grid: { left: 40, right: 20, top: 26, bottom: 32 },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: steps,
        axisLabel: { color: "#94a3b8", fontSize: 10 },
        axisLine: { lineStyle: { color: "#cbd5f5" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#94a3b8", fontSize: 10 },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.15)" } },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15, 23, 42, 0.88)",
        borderRadius: 10,
        padding: [8, 12],
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter(params: any) {
          if (!Array.isArray(params) || params.length === 0) {
            return "";
          }
          const item = params[0];
          const index = item.dataIndex;
          const timestamp = timestamps[index] ?? "";
          const step = steps[index] ?? 0;
          const value = values[index] ?? 0;
          return `
            <div style="display:flex;flex-direction:column;gap:6px;">
              <div style="font-size:11px;opacity:0.7;">${timestamp}</div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:#38bdf8;"></span>
                <span style="font-size:13px;">step ${step}</span>
              </div>
              <div style="font-size:16px;font-weight:600;">${value.toFixed(4)}</div>
            </div>
          `;
        },
      },
      series: [
        {
          type: "line",
          data: values,
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { width: 2, color: "#38bdf8" },
          itemStyle: { color: "#38bdf8", borderColor: "#ffffff" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(56, 189, 248, 0.45)" },
                { offset: 1, color: "rgba(56, 189, 248, 0.05)" },
              ],
            },
          },
          markPoint: {
            symbol: "pin",
            symbolSize: 36,
            itemStyle: { color: "#4f46e5" },
            label: { color: "#ffffff", fontSize: 11 },
            data: [
              {
                name: "Latest",
                coord: [latestStep, latestValue],
                value: latestValue.toFixed(4),
              },
            ],
          },
        },
      ],
    };
  }, [series]);

  return (
    <div className="training-chart h-40 w-full">
      <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
    </div>
  );
};

const HeatmapChart = () => {
  const points = useTensorboardStore((state) => state.points);
  const [hoveredCell, setHoveredCell] = useState<\uc5f4\ub839\ub9f5Cell | null>(null);

  const heatmap = useMemo(() => {
    if (points.length === 0) {
      return { cells: [] as \uc5f4\ub839\ub9f5Cell[], labels: [] as string[], matrixSize: 0, planeSize: 0 };
    }

    const coordinates = points.map((point) => [point.x, point.y, point.z]);
    const labels = ["X", "Y", "Z"];
    const matrixSize = labels.length;
    const offset = ((matrixSize - 1) * HEATMAP_CELL_SIZE) / 2;

    const cells: \uc5f4\ub839\ub9f5Cell[] = [];

    for (let row = 0; row < matrixSize; row += 1) {
      for (let col = 0; col < matrixSize; col += 1) {
        const axisRow = coordinates.map((coord) => coord[row] ?? 0);
        const axisCol = coordinates.map((coord) => coord[col] ?? 0);

        const meanRow = axisRow.reduce((sum, value) => sum + value, 0) / axisRow.length;
        const meanCol = axisCol.reduce((sum, value) => sum + value, 0) / axisCol.length;

        let numerator = 0;
        let denomRow = 0;
        let denomCol = 0;

        for (let index = 0; index < axisRow.length; index += 1) {
          const diffRow = axisRow[index] - meanRow;
          const diffCol = axisCol[index] - meanCol;
          numerator += diffRow * diffCol;
          denomRow += diffRow * diffRow;
          denomCol += diffCol * diffCol;
        }

        const denominator = Math.sqrt(denomRow * denomCol);
        const correlation = denominator === 0 ? 0 : numerator / denominator;
        const height = Math.max(Math.abs(correlation) * HEATMAP_HEIGHT_SCALE, 0.05);
        const position: [number, number, number] = [
          col * HEATMAP_CELL_SIZE - offset,
          height / 2,
          row * HEATMAP_CELL_SIZE - offset,
        ];

        cells.push({
          key: `${row}-${col}`,
          row,
          col,
          value: Number(correlation.toFixed(3)),
          height,
          color: correlationToColor(correlation),
          position,
          rowLabel: labels[row] ?? `Axis ${row + 1}`,
          colLabel: labels[col] ?? `Axis ${col + 1}`,
        });
      }
    }

    const planeSize = matrixSize * HEATMAP_CELL_SIZE + HEATMAP_CELL_SIZE * 0.6;
    return { cells, labels, matrixSize, planeSize };
  }, [points]);

  const planeMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useEffect(() => {
    const material = planeMaterialRef.current;
    if (!material) {
      return;
    }
    if (material.side !== THREE.DoubleSide) {
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    }
  }, []);

  if (heatmap.matrixSize === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-slate-500 dark:text-slate-300">
        {HEATMAP_EMPTY_MESSAGE}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [5.2, 5.1, 5.2], fov: 45 }} shadows>
        <color attach="background" args={["#020817"]} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[6, 8, 6]} intensity={1.1} castShadow />
        <directionalLight position={[-6, 4, -6]} intensity={0.45} />
        <OrbitControls
          enablePan
          enableRotate
          enableZoom
          minDistance={3}
          maxDistance={14}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 1.2, 0]}
        />
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[heatmap.planeSize, heatmap.planeSize]} />
            <meshStandardMaterial ref={planeMaterialRef} color="#0f172a" />
          </mesh>
          <Grid
            position={[0, 0.001, 0]}
            args={[heatmap.planeSize, heatmap.planeSize]}
            cellSize={HEATMAP_CELL_SIZE}
            cellColor="#1e293b"
            cellThickness={0.4}
            sectionSize={HEATMAP_CELL_SIZE * heatmap.matrixSize}
            sectionColor="#334155"
            sectionThickness={1}
            followCamera={false}
            infiniteGrid={false}
            fadeDistance={0}
          />
        </group>
        <group>
          {heatmap.cells.map((cell) => {
            const isHovered = hoveredCell?.key === cell.key;
            return (
              <mesh
                key={cell.key}
                position={cell.position}
                castShadow
                receiveShadow
                onPointerOver={() => setHoveredCell(cell)}
                onPointerMove={() => setHoveredCell(cell)}
                onPointerOut={() => setHoveredCell(null)}
              >
                <boxGeometry args={[HEATMAP_CELL_SIZE * 0.88, cell.height, HEATMAP_CELL_SIZE * 0.88]} />
                <meshStandardMaterial
                  color={cell.color}
                  emissive={cell.color}
                  emissiveIntensity={isHovered ? 0.35 : 0.08}
                  roughness={0.35}
                  metalness={0.05}
                />
              </mesh>
            );
          })}
        </group>
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-slate-900/70 px-3 py-2 text-xs text-slate-200 shadow-lg backdrop-blur">
        {hoveredCell ? (
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Correlation</div>
            <div className="text-sm font-semibold text-slate-100">
              {hoveredCell.rowLabel} {"\u00D7"} {hoveredCell.colLabel}
            </div>
            <div className="text-lg font-semibold text-sky-300">{hoveredCell.value.toFixed(3)}</div>
            <div className="text-[11px] text-slate-400">Height = |value|, Color encodes sign</div>
          </div>
        ) : (
          <div className="max-w-xs space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">3D \uc5f4\ub839\ub9f5</div>
            <p className="text-sm text-slate-200">{HEATMAP_INFO_DESCRIPTION}</p>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center gap-1 text-[11px] text-slate-300">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-blue-300">-1.0</span>
          <div className="h-2 w-48 rounded-full bg-gradient-to-r from-sky-500 via-slate-100 to-rose-500 shadow-inner" />
          <span className="font-semibold text-rose-300">+1.0</span>
        </div>
        <span>{HEATMAP_LEGEND_DESCRIPTION}</span>
      </div>

      <div className="pointer-events-none absolute right-4 bottom-4 flex flex-col items-end text-[11px] text-slate-400">
        <span className="font-semibold text-slate-200">Axis Reference</span>
        {heatmap.labels.map((label, index) => (
          <span key={label}>
            {index + 1}. {label} {HEATMAP_AXIS_SUFFIX}
          </span>
        ))}
      </div>
    </div>
  );
};

const TsneProgressView = () => {
  const {
    tsnePoints,
    tsneMeta,
    tsneError,
    loadingTsne,
    tsneSettings,
    setTsneSettings,
    fetchTsne,
  } = useTensorboardStore((state) => ({
    tsnePoints: state.tsnePoints,
    tsneMeta: state.tsneMeta,
    tsneError: state.tsneError,
    loadingTsne: state.loadingTsne,
    tsneSettings: state.tsneSettings,
    setTsneSettings: state.setTsneSettings,
    fetchTsne: state.fetchTsne,
  }));

  const maxStep = useMemo(() => {
    if (tsnePoints.length === 0) {
      return 1;
    }
    return tsnePoints.reduce((max, point) => (point.step > max ? point.step : max), 1);
  }, [tsnePoints]);

  const [highlightStep, setHighlightStep] = useState<number>(maxStep);

  useEffect(() => {
    if (tsnePoints.length === 0) {
      setHighlightStep(1);
      return;
    }
    setHighlightStep((previous) => {
      if (!Number.isFinite(previous) || previous <= 0) {
        return maxStep;
      }
      if (previous > maxStep) {
        return maxStep;
      }
      return previous;
    });
  }, [tsnePoints, maxStep]);

  const chartData = useMemo(
    () =>
      tsnePoints.map((point) => ({
        value: [point.x, point.y, point.step, point.progress],
        name: point.id,
        id: point.id,
        metadata: point.metadata,
        symbolSize: point.step <= highlightStep ? 11 : 6,
        itemStyle: {
          opacity: point.step <= highlightStep ? 0.9 : 0.12,
        },
      })),
    [tsnePoints, highlightStep]
  );

  const option = useMemo<EChartsOption>(() => {
    if (chartData.length === 0) {
      return {
        graphic: {
          type: "text",
          left: "center",
          top: "middle",
          style: {
            text: "T-SNE \uc88c\ud45c \ub370\uc774\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.\n\uc88c\ud45c\ub97c \uc0dd\uc131\ud558\ub824\uba74 T-SNE \uc7ac\uacc4\uc0b0\uc744 \uc2e4\ud589\ud558\uc138\uc694.",
            fill: "#94a3b8",
            fontSize: 13,
            lineHeight: 20,
            align: "center",
          },
        },
      };
    }
    return {
      animation: false,
      grid: { left: 52, right: 28, top: 40, bottom: maxStep > 1 ? 90 : 50 },
      xAxis: {
        type: "value",
        name: "TSNE-1",
        nameGap: 32,
        nameLocation: "middle",
        scale: true,
        axisLabel: { color: "#94a3b8" },
        axisLine: { lineStyle: { color: "#cbd5f5" } },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.12)" } },
      },
      yAxis: {
        type: "value",
        name: "TSNE-2",
        nameGap: 40,
        nameLocation: "middle",
        scale: true,
        axisLabel: { color: "#94a3b8" },
        axisLine: { lineStyle: { color: "#cbd5f5" } },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.12)" } },
      },
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        borderRadius: 10,
        padding: [10, 12],
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter(params: any) {
          if (!params || typeof params !== "object") {
            return "";
          }
          const value = Array.isArray(params.value) ? params.value : [];
          const [x, y, step, progress] = value;
          const data = params.data ?? {};
          const meta = data.metadata ?? {};
          const identifier = data.id ?? params.name ?? "";
          const primaryLabel =
            meta.PART_TYPE ??
            meta.part_type ??
            meta.ITEM_TYPE ??
            meta.item_type ??
            meta.ITEM_CD ??
            meta.item_cd ??
            "";
          const progressPercent =
            typeof progress === "number" && Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) * 100 : 0;
          return [
            `<div style="display:flex;flex-direction:column;gap:6px;">`,
            `<div style="font-weight:600;font-size:13px;">${identifier}</div>`,
            `<div style="font-size:12px;opacity:0.75;">${primaryLabel || "\uba54\ud0c0\ub370\uc774\ud130 \uc5c6\uc74c"}</div>`,
            `<div style="font-size:11px;">Step <strong>${step ?? "-"}</strong> \u00b7 Progress ${progressPercent.toFixed(1)}%</div>`,
            `<div style="font-size:11px;opacity:0.65;">x=${Number(x ?? 0).toFixed(2)}, y=${Number(y ?? 0).toFixed(2)}</div>`,
            `</div>`,
          ].join("");
        },
      },
      visualMap:
        maxStep > 1
          ? {
              show: true,
              min: 1,
              max: maxStep,
              dimension: 2,
              orient: "horizontal",
              left: "center",
              bottom: 24,
              text: ["\ud6c4\ubc18", "\ucd08\ubc18"],
              textStyle: { color: "#64748b", fontSize: 11 },
              inRange: { color: COLOR_PALETTE },
              calculable: false,
            }
          : undefined,
      series: [
        {
          type: "scatter",
          data: chartData,
          encode: { x: 0, y: 1 },
          itemStyle: { borderWidth: 0 },
          emphasis: { focus: "series", scale: true },
          large: chartData.length > 2000,
          largeThreshold: 2000,
          z: 2,
        },
      ],
    };
  }, [chartData, maxStep]);

  const activeCount = useMemo(() => {
    if (tsnePoints.length === 0) {
      return 0;
    }
    return tsnePoints.reduce((count, point) => (point.step <= highlightStep ? count + 1 : count), 0);
  }, [tsnePoints, highlightStep]);

  const progressShare = tsnePoints.length === 0 ? 0 : (activeCount / tsnePoints.length) * 100;
  const sampled = tsneMeta?.sampled ?? tsnePoints.length;
  const total = tsneMeta?.total ?? tsnePoints.length;
  const effectivePerplexity = tsneMeta?.effectivePerplexity ?? tsneSettings.perplexity;
  const requestedPerplexity = tsneMeta?.requestedPerplexity ?? tsneSettings.perplexity;
  const iterations = tsneMeta?.iterations ?? tsneSettings.iterations;
  const usedFallback = Boolean(tsneMeta?.usedPcaFallback);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/70 bg-white/70 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
        <label className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-200">\uc0d8\ud50c \uc218</span>
          <input
            type="number"
            min={200}
            max={5000}
            step={100}
            value={tsneSettings.limit}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              if (!Number.isNaN(next)) {
                setTsneSettings({ limit: next });
              }
            }}
            className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-200">Perplexity</span>
          <input
            type="range"
            min={5}
            max={80}
            step={5}
            value={tsneSettings.perplexity}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              if (!Number.isNaN(next)) {
                setTsneSettings({ perplexity: next });
              }
            }}
            className="h-1 w-32 cursor-pointer accent-indigo-500"
          />
          <span className="w-10 text-center font-semibold text-slate-700 dark:text-slate-200">{tsneSettings.perplexity}</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-200">\uc2a4\ud15d \ubd84\ud574</span>
          <input
            type="range"
            min={3}
            max={30}
            step={1}
            value={tsneSettings.steps}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              if (!Number.isNaN(next)) {
                setTsneSettings({ steps: next });
              }
            }}
            className="h-1 w-28 cursor-pointer accent-emerald-500"
          />
          <span className="w-8 text-center font-semibold text-slate-700 dark:text-slate-200">{tsneSettings.steps}</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-200">Iterations</span>
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800"
            value={tsneSettings.iterations}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              if (!Number.isNaN(next)) {
                setTsneSettings({ iterations: next });
              }
            }}
          >
            {[500, 750, 1000, 1500, 2000].map((option) => (
              <option key={option} value={option}>
                {option.toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-indigo-300 bg-indigo-500/90 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 dark:border-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            onClick={() => {
              void fetchTsne();
            }}
            disabled={loadingTsne}
          >
            {loadingTsne ? "\uacc4\uc0b0 \uc911\u2026" : "T-SNE \uc7ac\uacc4\uc0b0"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold">\uac15\uc870 \ub2e8\uacc4</span>
            <input
              type="range"
              min={1}
              max={Math.max(1, maxStep)}
              value={Math.min(highlightStep, Math.max(1, maxStep))}
              disabled={tsnePoints.length === 0 || maxStep <= 1}
              onChange={(event) => {
                const next = Number(event.currentTarget.value);
                if (!Number.isNaN(next)) {
                  setHighlightStep(next);
                }
              }}
              className="h-1 w-36 cursor-pointer accent-sky-500"
            />
            <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
              <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stepColor(highlightStep) }} />
              {tsnePoints.length === 0 ? "0 / 0" : `${highlightStep} / ${maxStep}`}
            </span>
          </label>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            \ud45c\uc2dc\ub41c \uc0d8\ud50c {activeCount.toLocaleString()}\uac1c \u00b7 \ub204\uc801 {progressShare.toFixed(1)}%
          </span>
        </div>

        <div className="relative flex-1 rounded-lg border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-900/70">
          {chartData.length > 0 ? (
            <ReactECharts option={option} style={{ height: "100%", width: "100%" }} opts={{ renderer: "canvas" }} notMerge lazyUpdate />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-300">
              {loadingTsne ? "T-SNE \uc88c\ud45c\ub97c \ub85c\ub529\uc911..." : "T-SNE \uc88c\ud45c \ub370\uc774\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4. \uc7ac\uacc4\uc0b0\uc744 \uc2e4\ud589\ud558\uc138\uc694."}
            </div>
          )}
          {loadingTsne ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-medium text-slate-600 backdrop-blur-sm dark:bg-slate-900/60 dark:text-slate-200">
              T-SNE \uc88c\ud45c\ub97c \ub85c\ub529\uc911...
            </div>
          ) : null}
        </div>

        {tsneError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            {tsneError}
          </div>
        ) : null}

        <div className="grid gap-3 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
          <div>
            \uc0d8\ud50c\ub9c1:{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {sampled.toLocaleString()} / {total.toLocaleString()}
            </span>
          </div>
          <div>
            Perplexity:{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {effectivePerplexity.toFixed(1)}
            </span>{" "}
            (\uc694\uccad {requestedPerplexity.toFixed(1)})
          </div>
          <div>
            Iterations:{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-100">{iterations.toLocaleString()}</span>
          </div>
          <div>
            \uac15\uc870 \ube44\uc728:{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-100">{progressShare.toFixed(1)}%</span>
          </div>
          {usedFallback ? (
            <div className="col-span-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
              \uc0d8\ud50c \uc218\uac00 \uc801\uc5b4 PCA \uae30\ubc18 2D \ub9e4\ud551\uc73c\ub85c \ub300\uccb4\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \uc0d8\ud50c \uc81c\ud55c\uc744 \ub298\ub9ac\uace0 \ub2e4\uc2dc \uacc4\uc0b0\ud574 \ubcf4\uc138\uc694.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

interface PointCloudProps {
  pointSize?: number;
  pointOpacity?: number;
  positionsOverride?: Float32Array | null;
  colorOverride?: Float32Array | null;
}

const PointCloud = ({
  pointSize = 0.12,
  pointOpacity = 0.9,
  positionsOverride = null,
  colorOverride = null,
}: PointCloudProps) => {
  const points = useTensorboardStore((state) => state.points);
  const colorField = useTensorboardStore((state) => state.colorField);

  // Create circular sprite texture
  const circleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw circle with soft edges
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
  }, []);

  const positions = useMemo(() => {
    if (positionsOverride && positionsOverride.length > 0) {
      return positionsOverride;
    }
    if (points.length === 0) {
      return new Float32Array();
    }
    const buffer = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i += 1) {
      const item = points[i];
      const offset = i * 3;
      buffer[offset] = item.x;
      buffer[offset + 1] = item.y;
      buffer[offset + 2] = item.z;
    }
    return buffer;
  }, [points, positionsOverride]);

  const colors = useMemo(() => {
    if (colorOverride && colorOverride.length > 0) {
      return colorOverride;
    }
    if (points.length === 0) {
      return new Float32Array();
    }
    const colorBuffer = new Float32Array(points.length * 3);
    const paletteCache = new Map<string, [number, number, number]>();
    let paletteIndex = 0;

    for (let i = 0; i < points.length; i += 1) {
      const item = points[i];
      let rgb: [number, number, number] = [0.38, 0.65, 0.98]; // default sky-400
      if (colorField && item.metadata[colorField] != null) {
        const key = String(item.metadata[colorField]);
        if (!paletteCache.has(key)) {
          const paletteColor = COLOR_PALETTE[paletteIndex % COLOR_PALETTE.length];
          paletteCache.set(key, hexToRGB(paletteColor));
          paletteIndex += 1;
        }
        rgb = paletteCache.get(key)!;
      }
      const offset = i * 3;
      colorBuffer[offset] = rgb[0];
      colorBuffer[offset + 1] = rgb[1];
      colorBuffer[offset + 2] = rgb[2];
    }
    return colorBuffer;
  }, [points, colorField, colorOverride]);

  const scaledPointSize = useMemo(() => {
    const count = points.length;
    if (count === 0) {
      return pointSize;
    }
    const scale =
      count >= 40000 ? 0.22 : count >= 20000 ? 0.3 : count >= 10000 ? 0.45 : count >= 5000 ? 0.65 : 1;
    const adjusted = pointSize * scale;
    return adjusted < 0.02 ? 0.02 : adjusted;
  }, [points.length, pointSize]);

  if (points.length === 0) {
    return null;
  }

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
        {colors.length > 0 ? (
          <bufferAttribute attach="attributes-color" array={colors} count={colors.length / 3} itemSize={3} />
        ) : null}
      </bufferGeometry>
      <pointsMaterial
        size={scaledPointSize}
        sizeAttenuation
        depthWrite={false}
        vertexColors
        transparent
        opacity={pointOpacity}
        map={circleTexture}
        alphaTest={0.1}
      />
    </points>
  );
};

export const TensorboardEmbeddingPanel = () => {
  const {
    projectors,
    selectedId,
    totalPoints,
    loadingProjectors,
    loadingPoints,
    error,
    filters,
    activeFilters,
    colorField,
    metrics,
    activeMetric,
    loadingMetrics,
    initialize,
    selectProjector,
    reloadProjectors,
    refreshPoints,
    setColorField,
    toggleFilterValue,
    clearFilters,
    setActiveMetric,
    fetchMetrics,
    pointLimit,
    pointStride,
    setPointLimit,
    setPointStride,
    points,
  } = useTensorboardStore();

  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('3d');
  const [pointSize, setPointSize] = useState(0.12);
  const [pointOpacity, setPointOpacity] = useState(0.9);
  const [axisMode, setAxisMode] = useState<'embedding' | 'feature'>('embedding');
  const [axisMapping, setAxisMapping] = useState<AxisMapping>({ x: null, y: null, z: null });
  const [colorMode, setColorMode] = useState<'metadata' | 'cluster'>('metadata');
  const [clusterCount, setClusterCount] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [projectorPath, setProjectorPath] = useState<string | null>(null);
  const [pathExists, setPathExists] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [initializedOnce, setInitializedOnce] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (colorMode === 'cluster' && clusterCount < 2) {
      setClusterCount(3);
    }
  }, [colorMode, clusterCount]);

  const numericFieldStats = useMemo<NumericFieldStat[]>(() => {
    if (points.length === 0) {
      return [];
    }
    const statsMap = new Map<string, { min: number; max: number; count: number }>();
    points.forEach((point) => {
      const metadata = point.metadata ?? {};
      Object.entries(metadata).forEach(([key, value]) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          const current = statsMap.get(key);
          if (current) {
            current.count += 1;
            if (value < current.min) {
              current.min = value;
            }
            if (value > current.max) {
              current.max = value;
            }
          } else {
            statsMap.set(key, { min: value, max: value, count: 1 });
          }
        }
      });
    });
    return Array.from(statsMap.entries())
      .map(([name, info]) => ({ name, min: info.min, max: info.max, count: info.count }))
      .filter((stat) => stat.count >= Math.min(points.length, 5));
  }, [points]);

  const numericFieldMap = useMemo<Record<string, NumericFieldStat>>(() => {
    const map: Record<string, NumericFieldStat> = {};
    numericFieldStats.forEach((stat) => {
      map[stat.name] = stat;
    });
    return map;
  }, [numericFieldStats]);

  useEffect(() => {
    if (numericFieldStats.length === 0) {
      setAxisMapping({ x: null, y: null, z: null });
      setAxisMode('embedding');
      return;
    }
    setAxisMapping((prev) => {
      const names = numericFieldStats.map((stat) => stat.name);
      const nextX = prev.x && names.includes(prev.x) ? prev.x : names[0] ?? null;
      const nextY = prev.y && names.includes(prev.y) ? prev.y : names[1] ?? names[0] ?? null;
      const nextZ = prev.z && names.includes(prev.z) ? prev.z : names[2] ?? names[1] ?? names[0] ?? null;
      if (nextX === prev.x && nextY === prev.y && nextZ === prev.z) {
        return prev;
      }
      return { x: nextX, y: nextY, z: nextZ };
    });
  }, [numericFieldStats]);

  const embeddingPositions = useMemo(() => {
    if (points.length === 0) {
      return new Float32Array();
    }
    const buffer = new Float32Array(points.length * 3);
    for (let index = 0; index < points.length; index += 1) {
      const base = index * 3;
      buffer[base] = points[index].x;
      buffer[base + 1] = points[index].y;
      buffer[base + 2] = points[index].z;
    }
    return buffer;
  }, [points]);

  const positionsBuffer = useMemo(() => {
    if (axisMode !== 'feature') {
      return embeddingPositions;
    }
    if (!axisMapping.x || !axisMapping.y || !axisMapping.z) {
      return embeddingPositions;
    }
    const xStats = numericFieldMap[axisMapping.x];
    const yStats = numericFieldMap[axisMapping.y];
    const zStats = numericFieldMap[axisMapping.z];
    if (!xStats || !yStats || !zStats) {
      return embeddingPositions;
    }
    const buffer = new Float32Array(points.length * 3);
    const halfRange = FEATURE_AXIS_RANGE / 2;
    for (let index = 0; index < points.length; index += 1) {
      const metadata = points[index].metadata ?? {};
      const xRaw = Number(metadata[axisMapping.x]);
      const yRaw = Number(metadata[axisMapping.y]);
      const zRaw = Number(metadata[axisMapping.z]);
      const base = index * 3;
      buffer[base] = normalizeToRange(xRaw, xStats.min, xStats.max) * halfRange;
      buffer[base + 1] = normalizeToRange(yRaw, yStats.min, yStats.max) * halfRange;
      buffer[base + 2] = normalizeToRange(zRaw, zStats.min, zStats.max) * halfRange;
    }
    return buffer;
  }, [axisMode, axisMapping, embeddingPositions, numericFieldMap, points]);

  const clusterVisual = useMemo(() => {
    if (colorMode !== 'cluster' || clusterCount < 2 || points.length === 0) {
      return { colors: null as Float32Array | null, legend: [] as Array<{ id: number; count: number; color: string }> };
    }
    const assignments = computeKMeansAssignments(positionsBuffer, points.length, clusterCount);
    if (!assignments) {
      return { colors: null as Float32Array | null, legend: [] as Array<{ id: number; count: number; color: string }> };
    }
    const colors = new Float32Array(points.length * 3);
    const counts = new Array(clusterCount).fill(0);
    for (let index = 0; index < points.length; index += 1) {
      const cluster = assignments[index] ?? 0;
      counts[cluster] += 1;
      const paletteColor = COLOR_PALETTE[cluster % COLOR_PALETTE.length];
      const rgb = hexToRGB(paletteColor);
      const base = index * 3;
      colors[base] = rgb[0];
      colors[base + 1] = rgb[1];
      colors[base + 2] = rgb[2];
    }
    const legend = counts
      .map((count, clusterIndex) => ({
        id: clusterIndex,
        count,
        color: COLOR_PALETTE[clusterIndex % COLOR_PALETTE.length],
      }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);
    return { colors, legend };
  }, [clusterCount, colorMode, points.length, positionsBuffer]);

  const clusterColorBuffer = clusterVisual.colors;
  const clusterLegend = clusterVisual.legend;
  const featureAxisAvailable = numericFieldStats.length > 0;
  const axisMappingComplete = axisMapping.x != null && axisMapping.y != null && axisMapping.z != null;

  const loadTensorboardConfig = useCallback(async () => {
    try {
      const config = await fetchTensorboardConfig();
      setProjectorPath(config.projectorPath);
      setPathExists(config.projectorPathExists);
      setConfigError(null);
    } catch (error) {
      console.warn("Failed to fetch TensorBoard config:", error);
      setConfigError("\uD150\uC11C\uBCF4\uB4DC \uC124\uC815 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
      throw error;
    }
  }, []);

  const handleInitialLoad = useCallback(async () => {
    if (initializing) {
      return;
    }
    setInitializing(true);
    setInitialLoadError(null);
    try {
      await initialize();
      await loadTensorboardConfig();
      setInitializedOnce(true);
    } catch (error) {
      console.error("TensorBoard initial load failed", error);
      setInitialLoadError("\uD150\uC11C\uBCF4\uB4DC \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uB3C4\uC911 \uBB38\uC81C\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    } finally {
      setInitializing(false);
    }
  }, [initializing, initialize, loadTensorboardConfig]);

  useEffect(() => {
    if (initializedOnce || initializing) {
      return;
    }
    void handleInitialLoad();
  }, [handleInitialLoad, initializedOnce, initializing]);

  const statusSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initializedOnce) {
      return;
    }
    let timerId: number | undefined;
    let cancelled = false;

    const pollStatus = async () => {
      try {
        const status = await fetchTrainingStatus();
        const signature =
          status.version_path ??
          (status.latest_version ? JSON.stringify(status.latest_version) : null) ??
          status.job_id ??
          null;
        if (signature == null) {
          return;
        }
        if (statusSignatureRef.current === null) {
          statusSignatureRef.current = signature;
          return;
        }
        if (signature !== statusSignatureRef.current) {
          statusSignatureRef.current = signature;
          if (!loadingProjectors) {
            await initialize();
            await loadTensorboardConfig();
          }
        }
      } catch (error) {
        console.warn("TensorBoard status polling failed", error);
      } finally {
        if (!cancelled) {
          timerId = window.setTimeout(() => void pollStatus(), 15000);
        }
      }
    };

    pollStatus();

    return () => {
      cancelled = true;
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, [initialize, initializedOnce, loadTensorboardConfig, loadingProjectors]);

  const handleExport = async () => {
    if (exporting) {
      return;
    }
    setExporting(true);
    setExportNote("\uB0B4\uBCF4\uB0B4\uAE30\uB97C \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4...");
    try {
      await exportTensorboardProjector({
        sample_every: Math.max(1, pointStride),
        max_rows: pointLimit,
      });
      setExportNote("\uB0B4\uBCF4\uB0B4\uAE30\uAC00 \uC644\uB8CC\uB418\uC5B4 \uD504\uB85C\uC81D\uD130 \uBAA9\uB85D\uC744 \uC7AC\uB85C\uB529\uD569\uB2C8\uB2E4...");
      await reloadProjectors();
      await loadTensorboardConfig();
      setExportNote("\uB0B4\uBCF4\uB0B4\uAE30\uAC00 \uC131\uACF5\uC801\uC73C\uB85C \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4!");
    } catch (error) {
      console.error("Failed to export TensorBoard projector", error);
      setExportNote("\uB0B4\uBCF4\uB0B4\uAE30\uAC00 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC138\uBD80 \uB0B4\uC6A9\uC740 \uCF58\uC194\uC744 \uD655\uC778\uD558\uC138\uC694.");
    } finally {
      setExporting(false);
      window.setTimeout(() => setExportNote(null), 6000);
    }
  };

  return (
    <section className="mt-12 rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">\ud150\uc11c\ubcf4\ub4dc \uc784\ub514\ub9c1 \ud654\uba74</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            3D \ubc29\uc2dd\uc73c\ub85c \ubaa8\ub378 \uc784\ub514\ub9c1 \ubd84\ud3ec\ub97c \uc2dc\uccad\ud558\uace0 \ud559\uc2b5 \uc9c4\ud589 \uc0c1\ud0dc\ub97c \ud655\uc778\ud574 \ubcf4\uc138\uc694.
          </p>
          {projectorPath ? (
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              \uc800\uc7a5 \uacbd\ub85c: <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{projectorPath}</code>
              {pathExists ? (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400">\uac00\uc785 \uac00\ub2a5</span>
              ) : (
                <span className="ml-2 text-amber-600 dark:text-amber-400">\uacbd\ub85c \ubbf8\uac00\uc785</span>
              )}
            </p>
          ) : null}
          {configError ? (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{configError}</p>
          ) : null}
          {exportNote ? (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{exportNote}</p>
          ) : null}
          {initialLoadError ? (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{initialLoadError}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-md border border-sky-400 bg-sky-500/90 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 dark:border-sky-500 dark:bg-sky-500/80 dark:hover:bg-sky-500"
            onClick={() => {
              void handleInitialLoad();
            }}
            disabled={initializing}
          >
            {initializing
              ? "\uB370\uC774\uD130 \uB85C\uB4DC \uC911..."
              : initializedOnce
                ? "\uB370\uC774\uD130 \uC7AC\uB85C\uB529"
                : "\uB370\uC774\uD130 \uBD88\uB7EC\uC624\uAE30"}
          </button>
          {initializedOnce ? (
            <>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span>\ud504\ub85c\uc81d\ud130</span>
                <select
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800"
                  value={selectedId ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) {
                      return;
                    }
                    void selectProjector(value);
                  }}
                  disabled={loadingProjectors || projectors.length === 0}
                >
                  {projectors.length === 0 ? <option value="">(\ub370\uc774\ud130 \uc5c6\uc74c)</option> : null}
                  {projectors.map((projector) => (
                    <option key={projector.id} value={projector.id}>
                      {projector.versionLabel ?? projector.id ?? "\uc774\ub984 \ubbf8\uc9c0\uc815"} -{' '}
                      {typeof projector.sampleCount === "number"
                        ? `${projector.sampleCount.toLocaleString()} \ud3ec\uc778\ud2b8`
                        : "0 \ud3ec\uc778\ud2b8"}
                    </option>
                  ))}
                </select>
              </label>
              {colorMode === 'metadata' ? (
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span>\uc0c9\uc0c1</span>
                  <select
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-800"
                    value={colorField ?? ""}
                    onChange={(event) => {
                      const nextColor = event.target.value || null;
                      setColorField(nextColor);
                    }}
                    disabled={filters.length === 0}
                  >
                    {filters.length === 0 ? <option value="">(\uc120\ud0dd \uac00\ub2a5 \ud544\ud130 \uc5c6\uc74c)</option> : null}
                    {filters.map((field) => (
                      <option key={field.name} value={field.name}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span>\uc810\uc218 \uc81c\ud55c</span>
                <select
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-800"
                  value={pointLimit}
                  onChange={(event) => {
                    const value = Number(event.target.value) || 1000;
                    setPointLimit(value);
                    void refreshPoints();
                  }}
                >
                  {[5000, 10000, 20000, 50000, 100000, 200000, 400000].map((option) => (
                    <option key={option} value={option}>
                      {option.toLocaleString()} \ud3ec\uc778\ud2b8
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span>\uc2a4\ud0c0\uc774\ub4dc</span>
                <select
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-800"
                  value={pointStride}
                  onChange={(event) => {
                    const value = Number(event.target.value) || 1;
                    setPointStride(value);
                    void refreshPoints();
                  }}
                  disabled={projectors.length === 0}
                >
                  {[1, 2, 5, 10, 20, 50].map((option) => (
                    <option key={option} value={option}>
                      x{option}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? "\uB0B4\uBCF4\uB0B4\uAE30 \uC9C4\uD589 \uC911..." : "\uBAA8\uB378\uC5D0\uC11C \uB0B4\uBCF4\uAE30"}
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => {
                  void reloadProjectors();
                }}
                disabled={loadingProjectors}
              >
                {loadingProjectors ? "\uBAA9\uB85D \uC7AC\uB85C\uB529 \uC911..." : "\uBAA9\uB85D \uC7AC\uB85C\uB529"}
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => {
                  void refreshPoints();
                }}
                disabled={loadingPoints || !selectedId}
              >
                {loadingPoints ? "\uD3EC\uC778\uD2B8 \uB85C\uB4DC \uC911..." : "\uD3EC\uC778\uD2B8 \uAC31\uC2E0"}
              </button>
            </>
          ) : null}
        {initializedOnce ? (
          <div className="w-full rounded-lg border border-slate-200 bg-white/70 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-slate-700 dark:text-slate-200">\uCD95 \uC120\uD0DD</span>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="tensorboard-axis-mode"
                  value="embedding"
                  checked={axisMode === 'embedding'}
                  onChange={() => setAxisMode('embedding')}
                />
                <span>\uC784\uBCA0\uB529 \uCD95</span>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="tensorboard-axis-mode"
                  value="feature"
                  checked={axisMode === 'feature'}
                  onChange={() => setAxisMode('feature')}
                  disabled={!featureAxisAvailable}
                />
                <span>\uD53C\uCC98 \uCD95</span>
              </label>
            </div>
            {axisMode === 'feature' ? (
              featureAxisAvailable && axisMappingComplete ? (
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                  {(['x', 'y', 'z'] as const).map((axisKey) => (
                    <label key={axisKey} className="flex flex-col gap-1">
                      <span className="font-medium text-slate-500 dark:text-slate-300">{`${axisKey.toUpperCase()} \uCD95`}</span>
                      <select
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800"
                        value={axisMapping[axisKey] ?? ''}
                        onChange={(event) => {
                          const nextField = event.target.value || null;
                          setAxisMapping((prev) => ({ ...prev, [axisKey]: nextField }));
                        }}
                      >
                        {numericFieldStats.map((stat) => (
                          <option key={stat.name} value={stat.name}>
                            {stat.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">\uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uC218\uCE58 \uD53C\uCC98 \uC815\uBCF4\uAC00 \uBD80\uC871\uD569\uB2C8\uB2E4.</p>
              )
            ) : null}
          </div>
        ) : null}
        {initializedOnce ? (
          <div className="w-full rounded-lg border border-slate-200 bg-white/70 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-slate-700 dark:text-slate-200">\uC0C9\uC0C1 \uC120\uD0DD</span>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-600 dark:bg-slate-800"
                value={colorMode}
                onChange={(event) => setColorMode(event.target.value as 'metadata' | 'cluster')}
              >
                <option value="metadata">\uBA54\uD0C0\uB370\uC774\uD130 \uC0C9\uC0C1</option>
                <option value="cluster">\uD074\uB7EC\uC2A4\uD130 \uC0C9\uC0C1</option>
              </select>
              {colorMode === 'cluster' ? (
                <label className="flex items-center gap-1">
                  <span>\uD074\uB7EC\uC2A4\uD130 \uAC1C\uC218</span>
                  <select
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-600 dark:bg-slate-800"
                    value={clusterCount}
                    onChange={(event) => setClusterCount(Number(event.target.value))}
                    disabled={points.length === 0}
                  >
                    {[3, 4, 5, 6].map((option) => (
                      <option key={option} value={option}>
                        {`${option} \uAC1C`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </div>
        ) : null}
        </div>
      </header>
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_minmax(240px,1fr)]">
        <div className="space-y-3">
          {/* Visualization Mode Toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                visualizationMode === '3d'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
              onClick={() => setVisualizationMode('3d')}
            >
              3D \ubcf4\uae30
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                visualizationMode === 'heatmap'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
              onClick={() => setVisualizationMode('heatmap')}
            >
              \uc5f4\ub839\ub9f5
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                visualizationMode === 'tsne'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
              onClick={() => setVisualizationMode('tsne')}
            >
              T-SNE \uc9c4\ud589
            </button>
          </div>

          {/* Visualization Area */}
          <div className="relative h-[520px] min-h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950">
            {!initializedOnce ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-300">
                <span>\uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uBA74 \uC2DC\uAC01\uD654\uAC00 \uCD9C\uB825\uB429\uB2C8\uB2E4.</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">\uC0C1\uB2E8\uc758 ‘\uB370\uC774\uD130 \uBD88\uB7EC\uC624\uAE30’ \ubc84\ud2bc\uc744 \ud074\ub9ad\ud574 \uc8fc\uc138\uc694.</span>
              </div>
            ) : visualizationMode === '3d' ? (
              <>
                <Canvas camera={{ position: [8, 8, 8], fov: 50 }}>
                  {/* Improved lighting */}
                  <ambientLight intensity={0.4} />
                  <directionalLight position={[10, 10, 10]} intensity={1.0} castShadow />
                  <directionalLight position={[-10, -10, -10]} intensity={0.3} />
                  <pointLight position={[0, 10, 0]} intensity={0.5} color="#a0d8ff" />

                  {/* Grid helper */}
                  {showGrid && (
                    <Grid
                      position={[0, -5, 0]}
                      args={[20, 20]}
                      cellSize={1}
                      cellThickness={0.5}
                      cellColor="#6366f1"
                      sectionSize={5}
                      sectionThickness={1}
                      sectionColor="#818cf8"
                      fadeDistance={30}
                      fadeStrength={1}
                      followCamera={false}
                      infiniteGrid
                    />
                  )}

                  {/* Point cloud */}
                  <PointCloud
                    pointSize={pointSize}
                    pointOpacity={pointOpacity}
                    positionsOverride={positionsBuffer}
                    colorOverride={colorMode === 'cluster' ? clusterColorBuffer : null}
                  />

                  {/* Controls */}
                  <OrbitControls
                    enablePan
                    enableRotate
                    enableZoom
                    minDistance={3}
                    maxDistance={50}
                    autoRotate={false}
                  />
                </Canvas>

                {/* 3D Visualization Controls */}
                <div className="absolute top-3 right-3 z-10">
                  <button
                    type="button"
                    className="rounded-lg bg-white/90 p-2 text-slate-700 shadow-lg backdrop-blur transition hover:bg-white dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => setShowControls(!showControls)}
                    title="3D \uc124\uc815"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </button>

                  {showControls && (
                    <div className="absolute right-0 top-12 w-72 rounded-lg border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
                      <h4 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">3D \uc2dc\uac01\ud654 \uc124\uc815</h4>

                      {/* Point Size Control */}
                      <div className="mb-4">
                        <label className="mb-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                          <span>\ud3ec\uc778\ud2b8 \ud06c\uae30</span>
                          <span className="font-mono text-indigo-600 dark:text-indigo-400">{pointSize.toFixed(2)}</span>
                        </label>
                        <input
                          type="range"
                          min="0.02"
                          max="0.6"
                          step="0.02"
                          value={pointSize}
                          onChange={(e) => setPointSize(Number(e.target.value))}
                          className="w-full accent-indigo-600"
                        />
                      </div>

                      {/* Point Opacity Control */}
                      <div className="mb-4">
                        <label className="mb-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                          <span>\ud3ec\uc778\ud2b8 \ud22c\uba85\ub3c4</span>
                          <span className="font-mono text-indigo-600 dark:text-indigo-400">{(pointOpacity * 100).toFixed(0)}%</span>
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={pointOpacity}
                          onChange={(e) => setPointOpacity(Number(e.target.value))}
                          className="w-full accent-indigo-600"
                        />
                      </div>

                      {/* Grid Toggle */}
                      <div className="mb-3 flex items-center justify-between">
                        <label className="text-xs text-slate-600 dark:text-slate-300">\uadf8\ub9ac\ub4dc \ud45c\uc2dc</label>
                        <button
                          type="button"
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                            showGrid ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                          onClick={() => setShowGrid(!showGrid)}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              showGrid ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Reset Button */}
                      <button
                        type="button"
                        className="mt-3 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        onClick={() => {
                          setPointSize(0.12);
                          setPointOpacity(0.9);
                          setShowGrid(true);
                        }}
                      >
                        \uae30\ubcf8\uac12\uc73c\ub85c \ucd08\uae30\ud654
                      </button>
                    </div>
                  )}
                </div>

                {loadingPoints ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm font-medium text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                    \uc784\ubca0\ub529 \ub370\uc774\ud130\ub97c \ubd88\ub7ec\uc624\ub294 \uc911\uc785\ub2c8\ub2e4...
                  </div>
                ) : null}
                {!loadingPoints && totalPoints === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 text-center text-sm text-slate-500 dark:bg-slate-900/70 dark:text-slate-300">
                    <span className="font-medium">\ud45c\uc2dc\ud560 \uc784\ubca0\ub529\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</span>
                    <span>\uD504\uB85C\uC81D\uD130\ub97c \uc120\ud0dd\ud558\uac70\ub098 \uc0c8\ub85c\uace0\uce68\uc744 \ub20c\ub7ec\uc8fc\uc138\uc694.</span>
                  </div>
                ) : null}
              </>
            ) : visualizationMode === 'heatmap' ? (
              <div className="flex h-full items-center justify-center p-6">
                <HeatmapChart />
              </div>
            ) : visualizationMode === 'tsne' ? (
              <TsneProgressView />
            ) : null}
          </div>
        </div>
        <aside className="space-y-4 rounded-lg border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/80">
          {!initializedOnce ? (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uBA74 \uD544\uD130\uC640 \uC0C1\uD0DC \uC815\uBCF4\uAC00 \uC5F4\uB9BD\uB429\uB2C8\uB2E4.
            </div>
          ) : (
            <>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">\uB370\uC774\uD130 \uC0C1\uD0DC</h3>
                <dl className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <dt>\uC120\uD0DD\uB41C 프로젝터</dt>
                    <dd>{selectedId ?? "-"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>\uD3EC\uC778\uD2B8 \uC218</dt>
                    <dd>{totalPoints.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>프로젝터 \uAC1C\uC218</dt>
                    <dd>{projectors.length}</dd>
                  </div>
                </dl>
              </div>
              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200">
                  {error}
                </div>
              ) : null}
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">\uD544\uD130</h3>
                  <button
                    type="button"
                    className="text-xs text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
                    onClick={() => {
                      clearFilters();
                      void refreshPoints();
                    }}
                    disabled={Object.keys(activeFilters).length === 0}
                  >
                    \uD544\uD130 \uCD08\uAE30\uD654
                  </button>
                </div>
                {filters.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">\uD544\uD130\ub9c1 \uAC00\uB2A5\uD55C \uBA54\uD0C0\uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {filters.map((field) => {
                      if (field.kind !== "categorical" || !field.values) {
                        return (
                          <li key={field.name} className="text-xs text-slate-500 dark:text-slate-400">
                            {field.label} - \uC9C0\uC6D0 \uC900\uBE44 \uC911
                          </li>
                        );
                      }
                      const active = new Set(activeFilters[field.name] ?? []);
                      return (
                        <li key={field.name}>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{field.label}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {field.values.map((value) => {
                              const selected = active.has(value);
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  className={`rounded-full border px-3 py-1 text-xs transition ${
                                    selected
                                      ? "border-sky-500 bg-sky-100 text-sky-700 dark:border-sky-400 dark:bg-sky-500/20 dark:text-sky-200"
                                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                  }`}
                                  onClick={() => {
                                    toggleFilterValue(field.name, value);
                                    void refreshPoints();
                                  }}
                                >
                                  {value}
                                </button>
                              );
                            })}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {colorMode === 'cluster' && clusterLegend.length > 0 ? (
                <div className="rounded-md border border-slate-200 bg-white/70 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">\uD074\uB7EC\uC2A4\uD130 \uC815\uBCF4</h4>
                  <ul className="mt-2 space-y-1">
                    {clusterLegend.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-200">{`\uD074\uB7EC\uC2A4\uD130 ${entry.id + 1}`}</span>
                        <span className="text-slate-400 dark:text-slate-500">{`${entry.count.toLocaleString()} \uD3EC\uC778\uD2B8`}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <p>\uD544\uD130\uc640 \uC0C9\uC0C1 \uB9E4\uD551\uC740 \uC0C1\uD0DC\uC5D0 \uBC18\uC601\uB418\uC5B4 3D \uB80C\uB354\uB9C1\uACFC \uC9C0\uD45C \uD0ED\uC5D0\uC11C \uACF5\uC720\uB429\uB2C8\uB2E4.</p>
                <p className="mt-1">\uB2E4\uC74C \uB2E8\uACC4\uC5D0\uC11C \uC2E4\uC81C TensorBoard \uC9C0\uD45C \uD0ED\uACFC \uC790\uB3D9 \uC5C5\uB370\uC774\uD2B8 \uB85C\uC9C1\uC744 \uC5F0\uACB0\uD560 \uC608\uC815\uC785\uB2C8\uB2E4.</p>
              </div>
            </>
          )}
        </aside>
      </div>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">\uc9c0\ud45c \ud0ed</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              TensorBoard Scalars\uc5d0\uc11c \ucd94\ucd9c\ud55c \uac12\uc744 \ud0ed\uc73c\ub85c \uc804\ud658\ud558\uba74\uc11c \ube44\uad50\ud569\ub2c8\ub2e4.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={() => {
              void fetchMetrics();
            }}
            disabled={loadingMetrics || !selectedId}
          >
            {loadingMetrics ? "\uc9c0\ud45c \uac31\uc2e0 \uc911..." : "\uc9c0\ud45c \uc0c8\ub85c\uace0\uce68"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {metrics.map((series) => {
            const selected = series.metric === activeMetric;
            return (
              <button
                key={series.metric}
                type="button"
                className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                  selected
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
                onClick={() => setActiveMetric(series.metric)}
              >
                {series.metric}
              </button>
            );
          })}
          {metrics.length === 0 ? (
            <span className="text-sm text-slate-500 dark:text-slate-400">\ud45c\uc2dc\ud560 \uc9c0\ud45c\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.</span>
          ) : null}
        </div>
        <div className="mt-4">
          {loadingMetrics ? (
            <div className="flex h-40 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              \uc9c0\ud45c \ub370\uc774\ud130\ub97c \ubd88\ub7ec\uc624\ub294 \uc911\uc785\ub2c8\ub2e4...
            </div>
          ) : null}
          {!loadingMetrics && metrics.length > 0 ? (
            <MetricChart series={metrics.find((item) => item.metric === activeMetric) ?? metrics[0]} />
          ) : null}
          {!loadingMetrics && metrics.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              \ud45c\uc2dc\ud560 \uc9c0\ud45c\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

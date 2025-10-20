import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import * as THREE from "three";

import { useTensorboardStore } from "@store/tensorboardStore";
import type { TensorboardMetricSeries } from "@app-types/tensorboard";
import { fetchTrainingStatus } from "@lib/apiClient";
import { exportTensorboardProjector } from "@lib/apiClient";

type VisualizationMode = '3d' | 'heatmap' | 'scatter';

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

const hexToRGB = (hex: string): [number, number, number] => {
  const cleanHex = hex.replace("#", "");
  const bigint = Number.parseInt(cleanHex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r / 255, g / 255, b / 255];
};

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
            text: "표시할 지표 데이터가 없습니다.",
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

  const { data, xAxis, yAxis } = useMemo(() => {
    if (points.length === 0) {
      return { data: [], xAxis: [], yAxis: [] };
    }

    // 포인트에서 x, y, z 좌표 추출
    const coordinates = points.map(p => [p.x, p.y, p.z]);

    // 간단한 상관관계 계산 (3차원 좌표 간)
    const dims = ['X', 'Y', 'Z'];
    const heatmapData: Array<[number, number, number]> = [];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const coordI = coordinates.map(c => c[i]);
        const coordJ = coordinates.map(c => c[j]);

        // 피어슨 상관계수 계산
        const meanI = coordI.reduce((a, b) => a + b, 0) / coordI.length;
        const meanJ = coordJ.reduce((a, b) => a + b, 0) / coordJ.length;

        let numerator = 0;
        let denomI = 0;
        let denomJ = 0;

        for (let k = 0; k < coordI.length; k++) {
          const diffI = coordI[k] - meanI;
          const diffJ = coordJ[k] - meanJ;
          numerator += diffI * diffJ;
          denomI += diffI * diffI;
          denomJ += diffJ * diffJ;
        }

        const correlation = denomI === 0 || denomJ === 0
          ? 0
          : numerator / Math.sqrt(denomI * denomJ);

        heatmapData.push([j, i, Number(correlation.toFixed(3))]);
      }
    }

    return { data: heatmapData, xAxis: dims, yAxis: dims };
  }, [points]);

  const option = useMemo<EChartsOption>(() => {
    if (data.length === 0) {
      return {
        graphic: {
          type: "text",
          left: "center",
          top: "middle",
          style: {
            text: "히트맵을 표시할 데이터가 없습니다.",
            fill: "#94a3b8",
            fontSize: 14,
          },
        },
      };
    }

    return {
      tooltip: {
        position: 'top',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderRadius: 8,
        padding: [10, 15],
        textStyle: { color: '#e2e8f0', fontSize: 13 },
        formatter: (params: any) => {
          const value = params.value[2];
          const xLabel = xAxis[params.value[0]];
          const yLabel = yAxis[params.value[1]];
          return `
            <div style="font-weight:600;margin-bottom:4px;">${yLabel} vs ${xLabel}</div>
            <div>상관계수: <span style="font-weight:700;color:#60a5fa;">${value.toFixed(3)}</span></div>
          `;
        }
      },
      grid: {
        left: 80,
        right: 40,
        top: 40,
        bottom: 80,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: xAxis,
        splitArea: { show: true, areaStyle: { color: ['rgba(250,250,250,0.05)', 'rgba(200,200,200,0.02)'] } },
        axisLabel: {
          color: '#cbd5e1',
          fontSize: 12,
          fontWeight: 600
        },
        axisLine: { lineStyle: { color: '#475569' } }
      },
      yAxis: {
        type: 'category',
        data: yAxis,
        splitArea: { show: true, areaStyle: { color: ['rgba(250,250,250,0.05)', 'rgba(200,200,200,0.02)'] } },
        axisLabel: {
          color: '#cbd5e1',
          fontSize: 12,
          fontWeight: 600
        },
        axisLine: { lineStyle: { color: '#475569' } }
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        textStyle: { color: '#cbd5e1' },
        inRange: {
          color: [
            '#313695', '#4575b4', '#74add1', '#abd9e9',
            '#e0f3f8', '#ffffbf', '#fee090', '#fdae61',
            '#f46d43', '#d73027', '#a50026'
          ]
        }
      },
      series: [{
        type: 'heatmap',
        data: data,
        label: {
          show: true,
          color: '#1e293b',
          fontSize: 13,
          fontWeight: 600,
          formatter: (params: any) => params.value[2].toFixed(2)
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
            borderColor: '#fff',
            borderWidth: 2
          }
        }
      }]
    };
  }, [data, xAxis, yAxis]);

  return (
    <div className="h-full w-full">
      <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
    </div>
  );
};

interface PointCloudProps {
  pointSize?: number;
  pointOpacity?: number;
}

const PointCloud = ({ pointSize = 0.25, pointOpacity = 0.9 }: PointCloudProps) => {
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
  }, [points]);

  const colors = useMemo(() => {
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
  }, [points, colorField]);

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
        size={pointSize}
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
  } = useTensorboardStore();

  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('3d');
  const [pointSize, setPointSize] = useState(0.25);
  const [pointOpacity, setPointOpacity] = useState(0.9);
  const [showGrid, setShowGrid] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [projectorPath, setProjectorPath] = useState<string | null>(null);
  const [pathExists, setPathExists] = useState(false);

  useEffect(() => {
    void initialize();
    // Fetch projector configuration
    fetch("/api/training/tensorboard/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.projector_path) {
          setProjectorPath(data.projector_path);
          setPathExists(data.projector_path_exists);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch TensorBoard config:", err);
      });
  }, [initialize]);

  const statusSignatureRef = useRef<string | null>(null);
  useEffect(() => {
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
  }, [initialize, loadingProjectors]);

  const handleExport = async () => {
    if (exporting) {
      return;
    }
    setExporting(true);
    setExportNote("Exporting embeddings, please wait...");
    try {
      await exportTensorboardProjector({
        sample_every: Math.max(1, pointStride),
        max_rows: pointLimit,
      });
      setExportNote("Export complete. Reloading projector list...");
      await reloadProjectors();
      setExportNote("Export complete!");
    } catch (error) {
      console.error("Failed to export TensorBoard projector", error);
      setExportNote("Export failed. Check console for details.");
    } finally {
      setExporting(false);
      window.setTimeout(() => setExportNote(null), 6000);
    }
  };

  return (
    <section className="mt-12 rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">TensorBoard Embedding Viewer</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Inspect model embeddings in 3D and review key training metrics.
          </p>
          {projectorPath ? (
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Export path: <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{projectorPath}</code>
              {pathExists ? (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400">✓ exists</span>
              ) : (
                <span className="ml-2 text-amber-600 dark:text-amber-400">⚠ not found</span>
              )}
            </p>
          ) : null}
          {exportNote ? (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{exportNote}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>Projector</span>
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
              {projectors.length === 0 ? <option value="">(no data)</option> : null}
              {projectors.map((projector) => (
                <option key={projector.id} value={projector.id}>
                  {projector.versionLabel ?? projector.id ?? "Unnamed"} - {typeof projector.sampleCount === "number" ? projector.sampleCount.toLocaleString() : "0"} points
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>Color</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-800"
              value={colorField ?? ""}
              onChange={(event) => {
                const value = event.target.value || null;
                setColorField(value);
              }}
              disabled={filters.length === 0}
            >
              {filters.length === 0 ? <option value="">(none)</option> : null}
              {filters.map((field) => (
                <option key={field.name} value={field.name}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>Point count</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800"
              value={pointLimit}
              onChange={(event) => {
                const value = Number(event.target.value) || 1000;
                setPointLimit(value);
                void refreshPoints();
              }}
            >
              {[5000, 10000, 20000, 50000, 100000, 200000, 400000].map((option) => (
                <option key={option} value={option}>
                  {option.toLocaleString()} points
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>Stride</span>
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
            {exporting ? "Exporting…" : "Export from model"}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={() => {
              void reloadProjectors();
            }}
            disabled={loadingProjectors}
          >
            {loadingProjectors ? "Refreshing…" : "Reload list"}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={() => {
              void refreshPoints();
            }}
            disabled={loadingPoints || !selectedId}
          >
            {loadingPoints ? "Loading points…" : "Update points"}
          </button>
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
              3D View
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
              Heatmap
            </button>
          </div>

          {/* Visualization Area */}
          <div className="relative h-[520px] min-h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950">
            {visualizationMode === '3d' ? (
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
                  <PointCloud pointSize={pointSize} pointOpacity={pointOpacity} />

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
                    title="3D 설정"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </button>

                  {showControls && (
                    <div className="absolute right-0 top-12 w-72 rounded-lg border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
                      <h4 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">3D 시각화 설정</h4>

                      {/* Point Size Control */}
                      <div className="mb-4">
                        <label className="mb-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                          <span>포인트 크기</span>
                          <span className="font-mono text-indigo-600 dark:text-indigo-400">{pointSize.toFixed(2)}</span>
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={pointSize}
                          onChange={(e) => setPointSize(Number(e.target.value))}
                          className="w-full accent-indigo-600"
                        />
                      </div>

                      {/* Point Opacity Control */}
                      <div className="mb-4">
                        <label className="mb-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                          <span>포인트 투명도</span>
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
                        <label className="text-xs text-slate-600 dark:text-slate-300">그리드 표시</label>
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
                          setPointSize(0.25);
                          setPointOpacity(0.9);
                          setShowGrid(true);
                        }}
                      >
                        기본값으로 초기화
                      </button>
                    </div>
                  )}
                </div>

                {loadingPoints ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm font-medium text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                    임베딩 데이터를 불러오는 중입니다...
                  </div>
                ) : null}
                {!loadingPoints && totalPoints === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 text-center text-sm text-slate-500 dark:bg-slate-900/70 dark:text-slate-300">
                    <span className="font-medium">표시할 임베딩이 없습니다.</span>
                    <span>Projector를 선택하거나 새로고침을 눌러주세요.</span>
                  </div>
                ) : null}
              </>
            ) : visualizationMode === 'heatmap' ? (
              <div className="flex h-full items-center justify-center p-6">
                <HeatmapChart />
              </div>
            ) : null}
          </div>
        </div>
        <aside className="space-y-4 rounded-lg border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/80">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">데이터 상태</h3>
            <dl className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <dt>선택된 Projector</dt>
                <dd>{selectedId ?? "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt>포인트 수</dt>
                <dd>{totalPoints.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Projector 개수</dt>
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
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">필터</h3>
              <button
                type="button"
                className="text-xs text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
                onClick={() => {
                  clearFilters();
                  void refreshPoints();
                }}
                disabled={Object.keys(activeFilters).length === 0}
              >
                필터 초기화
              </button>
            </div>
            {filters.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">필터링 가능한 메타데이터가 없습니다.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {filters.map((field) => {
                  if (field.kind !== "categorical" || !field.values) {
                    return (
                      <li key={field.name} className="text-xs text-slate-500 dark:text-slate-400">
                        {field.label} - 지원 준비 중
                      </li>
                    );
                  }
                  const active = new Set(activeFilters[field.name] ?? []);
                  return (
                    <li key={field.name}>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{field.label}</p>
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
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <p>필터와 색상 매핑은 상태에 반영되어 3D 렌더링과 지표 탭에서 공유됩니다.</p>
            <p className="mt-1">다음 단계에서 실제 TensorBoard 지표 탭과 자동 업데이트 로직을 연결할 예정입니다.</p>
          </div>
        </aside>
      </div>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">지표 탭</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              TensorBoard Scalars에서 추출한 값을 탭으로 전환하면서 비교합니다.
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
            {loadingMetrics ? "지표 갱신 중..." : "지표 새로고침"}
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
            <span className="text-sm text-slate-500 dark:text-slate-400">표시할 지표가 없습니다.</span>
          ) : null}
        </div>
        <div className="mt-4">
          {loadingMetrics ? (
            <div className="flex h-40 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              지표 데이터를 불러오는 중입니다...
            </div>
          ) : null}
          {!loadingMetrics && metrics.length > 0 ? (
            <MetricChart series={metrics.find((item) => item.metric === activeMetric) ?? metrics[0]} />
          ) : null}
          {!loadingMetrics && metrics.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              표시할 지표가 없습니다.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};








interface TrendChartProps {
  data: number[];
  label: string;
  color?: string;
  height?: number;
}

export function TrendChart({
  data,
  label,
  color = "#22c55e",
  height = 60,
}: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center text-gray-500 text-sm py-4">No trend data</div>
    );
  }

  const max = Math.max(...data, 100);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = ((max - value) / range) * height;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;

  // Create area fill path
  const areaD = `${pathD} L 100,${height} L 0,${height} Z`;

  return (
    <div className="w-full">
      <div className="text-xs text-gray-400 mb-2">{label}</div>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {/* Grid lines */}
        <line
          x1="0"
          y1={height / 2}
          x2="100"
          y2={height / 2}
          stroke="#374151"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />

        {/* Area fill */}
        <path
          d={areaD}
          fill={color}
          fillOpacity="0.1"
        />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((point, index) => {
          const [x, y] = point.split(",").map(Number);
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="1.5"
              fill={color}
              className="hover:r-3 transition-all"
            >
              <title>{`${label}: ${data[index].toFixed(1)}%`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{data.length} periods ago</span>
        <span>Now</span>
      </div>
    </div>
  );
}

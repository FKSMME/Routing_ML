import type { NodeConnection } from "@app-types/routing";
import { useEffect, useState } from "react";

interface TimelineWireProps {
  connection: NodeConnection;
  sourceElement: HTMLElement | null;
  targetElement: HTMLElement | null;
  selected?: boolean;
  onSelect?: (connectionId: string) => void;
}

/**
 * TimelineWire - SVG wire component connecting timeline nodes
 *
 * Renders a Bezier curve connecting two timeline step nodes.
 * Automatically recalculates path when node positions change.
 */
export function TimelineWire({
  connection,
  sourceElement,
  targetElement,
  selected = false,
  onSelect,
}: TimelineWireProps) {
  const [path, setPath] = useState<string>("");

  // Calculate Bezier curve path
  useEffect(() => {
    if (!sourceElement || !targetElement) {
      setPath("");
      return;
    }

    const calculatePath = () => {
      const sourceRect = sourceElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();

      // Get parent container to calculate relative positions
      const container = sourceElement.closest('.timeline-panel') as HTMLElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();

      // Calculate connection points (center-right of source, center-left of target)
      const startX = sourceRect.right - containerRect.left;
      const startY = sourceRect.top + sourceRect.height / 2 - containerRect.top;
      const endX = targetRect.left - containerRect.left;
      const endY = targetRect.top + targetRect.height / 2 - containerRect.top;

      // Calculate control points for smooth Bezier curve
      const controlPointOffset = Math.min(Math.abs(endX - startX) * 0.5, 150);
      const control1X = startX + controlPointOffset;
      const control1Y = startY;
      const control2X = endX - controlPointOffset;
      const control2Y = endY;

      // Create SVG path (cubic Bezier curve)
      const svgPath = `M ${startX} ${startY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${endX} ${endY}`;
      setPath(svgPath);
    };

    calculatePath();

    // Recalculate on scroll or resize
    const handleUpdate = () => calculatePath();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [sourceElement, targetElement]);

  if (!path) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(connection.id);
    }
  };

  return (
    <g className="timeline-wire" data-connection-id={connection.id}>
      {/* Invisible thicker path for easier clicking */}
      <path
        d={path}
        className="timeline-wire__hit-area"
        fill="none"
        stroke="transparent"
        strokeWidth="20"
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      />

      {/* Visible wire path */}
      <path
        d={path}
        className={`timeline-wire__path${selected ? ' timeline-wire__path--selected' : ''}`}
        fill="none"
        stroke={selected ? 'rgb(56, 189, 248)' : 'rgba(148, 163, 184, 0.4)'}
        strokeWidth={selected ? 3 : 2}
        onClick={handleClick}
        style={{
          cursor: 'pointer',
          transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
          filter: selected ? 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.8))' : undefined,
        }}
      />

      {/* Arrow marker at the end */}
      <defs>
        <marker
          id={`arrow-${connection.id}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            fill={selected ? 'rgb(56, 189, 248)' : 'rgba(148, 163, 184, 0.4)'}
          />
        </marker>
      </defs>
    </g>
  );
}

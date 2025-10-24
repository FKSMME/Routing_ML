/**
 * CustomNodeCard - Draggable card for user-managed custom process nodes
 *
 * Phase 3: UI Component Implementation
 */

import type { CustomNode } from "@app-types/customNodes";
import { Edit2, GripVertical, Trash2 } from "lucide-react";
import React from "react";

interface CustomNodeCardProps {
  node: CustomNode;
  onEdit: (node: CustomNode) => void;
  onDelete: (node: CustomNode) => void;
  draggable?: boolean;
}

export const CustomNodeCard: React.FC<CustomNodeCardProps> = ({
  node,
  onEdit,
  onDelete,
  draggable = true,
}) => {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggable) return;

    // Set drag data format compatible with existing drag & drop system
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        type: "custom-node",
        process_code: node.process_code,
        process_name: node.process_name,
        estimated_time: node.estimated_time,
        color: node.color,
        node_id: node.id,
      })
    );
  };

  const backgroundColor = node.color || "#6366f1";
  const textColor = "#ffffff";

  return (
    <div
      draggable={draggable}
      onDragStart={handleDragStart}
      className={`
        custom-node-card
        px-3 py-2 sm:px-4 sm:py-3 rounded-lg border-2 transition-all duration-200
        flex flex-col items-start gap-2 min-w-[140px] sm:min-w-[160px]
        relative group
        ${draggable ? "cursor-grab active:cursor-grabbing hover:shadow-lg hover:scale-105" : ""}
      `}
      style={{
        backgroundColor,
        borderColor: backgroundColor,
      }}
      role="button"
      aria-label={`Custom node: ${node.process_name} (${node.process_code})`}
      title={draggable ? `Drag to add: ${node.process_name}` : node.process_name}
    >
      {/* Drag Handle Icon */}
      {draggable && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-70 transition-opacity">
          <GripVertical className="w-4 h-4" style={{ color: textColor }} />
        </div>
      )}

      {/* Process Code */}
      <div className="flex items-center justify-between w-full">
        <span
          className="font-mono text-xs sm:text-sm font-bold"
          style={{ color: textColor }}
        >
          {node.process_code}
        </span>
      </div>

      {/* Process Name */}
      <div className="w-full">
        <div
          className="text-xs sm:text-sm font-semibold truncate"
          style={{ color: textColor }}
        >
          {node.process_name}
        </div>

        {/* Estimated Time */}
        {node.estimated_time && (
          <div className="text-[11px] mt-1" style={{ color: textColor, opacity: 0.9 }}>
            ~{node.estimated_time} min
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 w-full mt-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(node);
          }}
          className="flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs rounded transition-all hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
          style={{ color: textColor }}
          aria-label={`Edit ${node.process_name}`}
        >
          <Edit2 className="w-3 h-3" />
          <span className="hidden sm:inline">Edit</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node);
          }}
          className="flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs rounded transition-all hover:bg-red-500/30 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          style={{ color: textColor }}
          aria-label={`Delete ${node.process_name}`}
        >
          <Trash2 className="w-3 h-3" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>
    </div>
  );
};

export default CustomNodeCard;

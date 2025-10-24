/**
 * CustomNodeModal - Add/Edit form for custom process nodes
 *
 * Phase 3: UI Component Implementation
 */

import type { CustomNode, CustomNodeCreatePayload, CustomNodeUpdatePayload } from "@app-types/customNodes";
import { Save, X } from "lucide-react";
import React, { useEffect, useState } from "react";

interface CustomNodeModalProps {
  open: boolean;
  mode: "create" | "edit";
  node?: CustomNode | null;
  onClose: () => void;
  onSave: (payload: CustomNodeCreatePayload | CustomNodeUpdatePayload) => void;
  loading?: boolean;
}

const PRESET_COLORS = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Yellow", value: "#f59e0b" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Pink", value: "#ec4899" },
  { name: "Purple", value: "#a855f7" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Gray", value: "#6b7280" },
];

export const CustomNodeModal: React.FC<CustomNodeModalProps> = ({
  open,
  mode,
  node,
  onClose,
  onSave,
  loading = false,
}) => {
  const [processCode, setProcessCode] = useState("");
  const [processName, setProcessName] = useState("");
  const [estimatedTime, setEstimatedTime] = useState<string>("");
  const [color, setColor] = useState(PRESET_COLORS[0].value);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form when modal opens
  useEffect(() => {
    if (open) {
      if (mode === "edit" && node) {
        setProcessCode(node.process_code);
        setProcessName(node.process_name);
        setEstimatedTime(node.estimated_time ? String(node.estimated_time) : "");
        setColor(node.color || PRESET_COLORS[0].value);
      } else {
        // Reset for create mode
        setProcessCode("");
        setProcessName("");
        setEstimatedTime("");
        setColor(PRESET_COLORS[0].value);
      }
      setErrors({});
    }
  }, [open, mode, node]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!processCode.trim()) {
      newErrors.processCode = "Process code is required";
    } else if (processCode.length > 50) {
      newErrors.processCode = "Process code must be 50 characters or less";
    }

    if (!processName.trim()) {
      newErrors.processName = "Process name is required";
    } else if (processName.length > 100) {
      newErrors.processName = "Process name must be 100 characters or less";
    }

    if (estimatedTime && Number(estimatedTime) < 0) {
      newErrors.estimatedTime = "Estimated time must be positive";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const payload: CustomNodeCreatePayload = {
      process_code: processCode.trim(),
      process_name: processName.trim(),
      estimated_time: estimatedTime ? Number(estimatedTime) : null,
      color,
    };

    onSave(payload);
  };

  const handleCancel = () => {
    setErrors({});
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {mode === "create" ? "Add Custom Process Node" : "Edit Custom Process Node"}
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Help Text */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-md p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Create custom process nodes for operations that ML cannot recommend (e.g., welding, painting, inspection).
            </p>
          </div>

          {/* Process Code */}
          <div>
            <label
              htmlFor="processCode"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Process Code <span className="text-red-500">*</span>
            </label>
            <input
              id="processCode"
              type="text"
              value={processCode}
              onChange={(e) => setProcessCode(e.target.value.toUpperCase())}
              placeholder="WELD, PAINT, INSPECT, etc."
              disabled={loading || (mode === "edit" && !!node)}
              className={`w-full px-3 py-2 bg-white dark:bg-gray-700 border rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.processCode ? "border-red-500" : "border-gray-300 dark:border-gray-600"
              } ${mode === "edit" && node ? "opacity-60 cursor-not-allowed" : ""}`}
            />
            {errors.processCode && (
              <p className="mt-1 text-xs text-red-500">{errors.processCode}</p>
            )}
            {mode === "edit" && node && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Process code cannot be changed after creation
              </p>
            )}
          </div>

          {/* Process Name */}
          <div>
            <label
              htmlFor="processName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Process Name <span className="text-red-500">*</span>
            </label>
            <input
              id="processName"
              type="text"
              value={processName}
              onChange={(e) => setProcessName(e.target.value)}
              placeholder="용접, 도색, 검사, etc."
              disabled={loading}
              className={`w-full px-3 py-2 bg-white dark:bg-gray-700 border rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.processName ? "border-red-500" : "border-gray-300 dark:border-gray-600"
              }`}
            />
            {errors.processName && (
              <p className="mt-1 text-xs text-red-500">{errors.processName}</p>
            )}
          </div>

          {/* Estimated Time */}
          <div>
            <label
              htmlFor="estimatedTime"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Estimated Time (minutes)
            </label>
            <input
              id="estimatedTime"
              type="number"
              min="0"
              step="1"
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(e.target.value)}
              placeholder="60"
              disabled={loading}
              className={`w-full px-3 py-2 bg-white dark:bg-gray-700 border rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.estimatedTime ? "border-red-500" : "border-gray-300 dark:border-gray-600"
              }`}
            />
            {errors.estimatedTime && (
              <p className="mt-1 text-xs text-red-500">{errors.estimatedTime}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Optional: Approximate duration for this process
            </p>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Node Color
            </label>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  disabled={loading}
                  className={`h-10 rounded-md border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    color === preset.value
                      ? "border-gray-900 dark:border-white scale-110"
                      : "border-gray-300 dark:border-gray-600 hover:scale-105"
                  }`}
                  style={{ backgroundColor: preset.value }}
                  title={preset.name}
                  aria-label={`Select ${preset.name} color`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Select a color for easy identification
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{mode === "create" ? "Create" : "Save Changes"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomNodeModal;

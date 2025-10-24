/**
 * CustomNodeList - Horizontal scroll layout for custom process nodes
 *
 * Phase 3: UI Component Implementation
 *
 * Displays user-managed custom process nodes in a single-line horizontal layout
 * with add/edit/delete functionality.
 */

import type { CustomNode, CustomNodeCreatePayload, CustomNodeUpdatePayload } from "@app-types/customNodes";
import {
  useCreateCustomNode,
  useCustomNodes,
  useDeleteCustomNode,
  useUpdateCustomNode,
} from "@hooks/useCustomNodes";
import { AlertCircle, Plus } from "lucide-react";
import React, { useState } from "react";

import { CustomNodeCard } from "./CustomNodeCard";
import { CustomNodeModal } from "./CustomNodeModal";

interface CustomNodeListProps {
  className?: string;
}

export const CustomNodeList: React.FC<CustomNodeListProps> = ({ className = "" }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedNode, setSelectedNode] = useState<CustomNode | null>(null);
  const [deleteConfirmNode, setDeleteConfirmNode] = useState<CustomNode | null>(null);

  // React Query hooks
  const { data: nodes = [], isLoading, error } = useCustomNodes();
  const createMutation = useCreateCustomNode();
  const updateMutation = useUpdateCustomNode();
  const deleteMutation = useDeleteCustomNode();

  const handleAddClick = () => {
    setModalMode("create");
    setSelectedNode(null);
    setModalOpen(true);
  };

  const handleEditClick = (node: CustomNode) => {
    setModalMode("edit");
    setSelectedNode(node);
    setModalOpen(true);
  };

  const handleDeleteClick = (node: CustomNode) => {
    setDeleteConfirmNode(node);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmNode) return;

    deleteMutation.mutate(deleteConfirmNode.id, {
      onSuccess: () => {
        setDeleteConfirmNode(null);
      },
      onError: (error) => {
        console.error("Failed to delete custom node:", error);
        alert(`Failed to delete node: ${error.message}`);
      },
    });
  };

  const handleSave = (payload: CustomNodeCreatePayload | CustomNodeUpdatePayload) => {
    if (modalMode === "create") {
      createMutation.mutate(payload as CustomNodeCreatePayload, {
        onSuccess: () => {
          setModalOpen(false);
        },
        onError: (error) => {
          console.error("Failed to create custom node:", error);
          alert(`Failed to create node: ${error.message}`);
        },
      });
    } else if (selectedNode) {
      updateMutation.mutate(
        {
          nodeId: selectedNode.id,
          payload: payload as CustomNodeUpdatePayload,
        },
        {
          onSuccess: () => {
            setModalOpen(false);
            setSelectedNode(null);
          },
          onError: (error) => {
            console.error("Failed to update custom node:", error);
            alert(`Failed to update node: ${error.message}`);
          },
        }
      );
    }
  };

  if (isLoading) {
    return (
      <div className={`custom-node-list ${className}`} role="region" aria-label="Custom process nodes">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading custom nodes...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`custom-node-list ${className}`} role="region" aria-label="Custom process nodes">
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-700 dark:text-red-300">
            Failed to load custom nodes: {error.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`custom-node-list ${className}`} role="region" aria-label="Custom process nodes">
        {/* Header */}
        <div className="mb-2 sm:mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Custom Process Nodes
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Drag nodes to routing timeline • Total: {nodes.length}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddClick}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Add new custom node"
          >
            <Plus className="w-4 h-4" />
            <span>Add Node</span>
          </button>
        </div>

        {/* Node List */}
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              No custom nodes yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Create custom process nodes for welding, painting, inspection, etc.
            </p>
            <button
              type="button"
              onClick={handleAddClick}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create your first node</span>
            </button>
          </div>
        ) : (
          <div
            className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scroll-smooth"
            role="list"
            aria-label="Custom process nodes"
          >
            {nodes.map((node) => (
              <div key={node.id} role="listitem">
                <CustomNodeCard
                  node={node}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                  draggable={true}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <CustomNodeModal
        open={modalOpen}
        mode={modalMode}
        node={selectedNode}
        onClose={() => {
          setModalOpen(false);
          setSelectedNode(null);
        }}
        onSave={handleSave}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirmNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Custom Node
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete <strong>{deleteConfirmNode.process_name}</strong> (
              {deleteConfirmNode.process_code})? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmNode(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomNodeList;

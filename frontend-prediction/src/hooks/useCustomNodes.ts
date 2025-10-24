/**
 * Custom Process Nodes React Query Hook
 *
 * Phase 2: Frontend State Management
 *
 * Provides CRUD operations for user-managed custom process nodes with:
 * - Automatic data fetching and caching
 * - Optimistic updates for better UX
 * - Error handling and loading states
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCustomNode,
  deleteCustomNode,
  fetchCustomNodes,
  updateCustomNode,
  type CustomNode,
  type CustomNodeCreatePayload,
  type CustomNodeUpdatePayload,
} from "@lib/apiClient";

export interface UseCustomNodesOptions {
  /**
   * 쿼리 활성화 여부. 기본값: true
   */
  enabled?: boolean;
}

/**
 * 커스텀 프로세스 노드 목록을 조회하는 Hook
 *
 * @example
 * ```tsx
 * const { data: nodes, isLoading } = useCustomNodes();
 *
 * if (isLoading) return <div>Loading...</div>;
 *
 * return (
 *   <div>
 *     {nodes?.map(node => (
 *       <div key={node.id}>{node.process_name}</div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useCustomNodes(options: UseCustomNodesOptions = {}) {
  const { enabled = true } = options;

  return useQuery<CustomNode[], Error>({
    queryKey: ["customNodes"],
    queryFn: fetchCustomNodes,
    enabled,
    staleTime: 30000, // 30초 동안 캐시 유효
    retry: 1, // 실패 시 1회 재시도
  });
}

/**
 * 커스텀 프로세스 노드를 생성하는 Mutation Hook
 *
 * @example
 * ```tsx
 * const createMutation = useCreateCustomNode();
 *
 * const handleCreate = () => {
 *   createMutation.mutate({
 *     process_code: "WELD",
 *     process_name: "용접",
 *     estimated_time: 60,
 *     color: "#FF5733"
 *   });
 * };
 * ```
 */
export function useCreateCustomNode() {
  const queryClient = useQueryClient();

  return useMutation<CustomNode, Error, CustomNodeCreatePayload>({
    mutationFn: createCustomNode,
    onMutate: async (newNode) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["customNodes"] });

      // Snapshot previous value
      const previousNodes = queryClient.getQueryData<CustomNode[]>(["customNodes"]);

      // Optimistically update to the new value
      if (previousNodes) {
        const optimisticNode: CustomNode = {
          id: `temp-${Date.now()}`,
          user_id: "current",
          process_code: newNode.process_code,
          process_name: newNode.process_name,
          estimated_time: newNode.estimated_time ?? null,
          color: newNode.color ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<CustomNode[]>(["customNodes"], [...previousNodes, optimisticNode]);
      }

      return { previousNodes };
    },
    onError: (_err, _newNode, context) => {
      // Rollback on error
      if (context?.previousNodes) {
        queryClient.setQueryData(["customNodes"], context.previousNodes);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ["customNodes"] });
    },
  });
}

/**
 * 커스텀 프로세스 노드를 업데이트하는 Mutation Hook
 *
 * @example
 * ```tsx
 * const updateMutation = useUpdateCustomNode();
 *
 * const handleUpdate = (nodeId: string) => {
 *   updateMutation.mutate({
 *     nodeId,
 *     payload: { process_name: "새 용접" }
 *   });
 * };
 * ```
 */
export function useUpdateCustomNode() {
  const queryClient = useQueryClient();

  return useMutation<CustomNode, Error, { nodeId: string; payload: CustomNodeUpdatePayload }>({
    mutationFn: ({ nodeId, payload }) => updateCustomNode(nodeId, payload),
    onMutate: async ({ nodeId, payload }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["customNodes"] });

      // Snapshot previous value
      const previousNodes = queryClient.getQueryData<CustomNode[]>(["customNodes"]);

      // Optimistically update
      if (previousNodes) {
        const updatedNodes = previousNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                ...payload,
                updated_at: new Date().toISOString(),
              }
            : node
        );
        queryClient.setQueryData<CustomNode[]>(["customNodes"], updatedNodes);
      }

      return { previousNodes };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousNodes) {
        queryClient.setQueryData(["customNodes"], context.previousNodes);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ["customNodes"] });
    },
  });
}

/**
 * 커스텀 프로세스 노드를 삭제하는 Mutation Hook
 *
 * @example
 * ```tsx
 * const deleteMutation = useDeleteCustomNode();
 *
 * const handleDelete = (nodeId: string) => {
 *   if (confirm("정말 삭제하시겠습니까?")) {
 *     deleteMutation.mutate(nodeId);
 *   }
 * };
 * ```
 */
export function useDeleteCustomNode() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteCustomNode,
    onMutate: async (nodeId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["customNodes"] });

      // Snapshot previous value
      const previousNodes = queryClient.getQueryData<CustomNode[]>(["customNodes"]);

      // Optimistically remove from list
      if (previousNodes) {
        const updatedNodes = previousNodes.filter((node) => node.id !== nodeId);
        queryClient.setQueryData<CustomNode[]>(["customNodes"], updatedNodes);
      }

      return { previousNodes };
    },
    onError: (_err, _nodeId, context) => {
      // Rollback on error
      if (context?.previousNodes) {
        queryClient.setQueryData(["customNodes"], context.previousNodes);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ["customNodes"] });
    },
  });
}

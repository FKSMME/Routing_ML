import type { WorkflowConfigPatch, WorkflowConfigResponse } from "@app-types/workflow";
import { fetchWorkflowConfig, patchWorkflowConfig } from "@lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const QUERY_KEY = ["workflow-config"];

export function useWorkflowConfig() {
  const queryClient = useQueryClient();

  const query = useQuery<WorkflowConfigResponse>({
    queryKey: QUERY_KEY,
    queryFn: fetchWorkflowConfig,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (payload: WorkflowConfigPatch) => patchWorkflowConfig(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data);
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refresh: query.refetch,
    saveConfig: mutation.mutateAsync,
    saving: mutation.isPending,
  };
}

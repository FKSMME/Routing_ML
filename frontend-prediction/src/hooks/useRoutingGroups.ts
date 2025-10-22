import type {
  RoutingGroupCreateResponse,
  RoutingGroupDetail,
  RoutingGroupListResponse,
  RoutingGroupStep,
  TimelineStepMetadata,
} from "@app-types/routing";
// Routing groups API functions removed - feature not used in prediction-only frontend
// import {
//   createRoutingGroup,
//   fetchRoutingGroup,
//   listRoutingGroups,
//   postUiAudit,
// } from "@lib/apiClient";
import { useRoutingStore } from "@store/routingStore";
import { useWorkspaceStore } from "@store/workspaceStore";
import axios from "axios";
import { useCallback } from "react";

interface SaveGroupArgs {
  groupName: string;
  metadata?: Record<string, unknown> | null;
}

interface SaveGroupResult {
  ok: boolean;
  message: string;
  response?: RoutingGroupCreateResponse;
}

interface LoadGroupResult {
  ok: boolean;
  message: string;
  detail?: RoutingGroupDetail;
}

const cloneStepMetadata = (metadata?: TimelineStepMetadata | null): TimelineStepMetadata | null => {
  if (!metadata) {
    return null;
  }
  const cloned: TimelineStepMetadata = { ...metadata };
  if (metadata.sqlValues) {
    cloned.sqlValues = { ...metadata.sqlValues };
  } else if (metadata.sqlValues === null) {
    cloned.sqlValues = null;
  }
  if (metadata.extra) {
    cloned.extra = { ...metadata.extra };
  } else if (metadata.extra === null) {
    cloned.extra = null;
  }
  return cloned;
};

const buildSteps = (timeline: ReturnType<typeof useRoutingStore.getState>["timeline"]): RoutingGroupStep[] =>
  timeline.map((step, index) => {
    const metadata = cloneStepMetadata(step.metadata);
    const sqlValues = step.sqlValues ?? metadata?.sqlValues ?? null;
    if (metadata && sqlValues && metadata.sqlValues !== sqlValues) {
      metadata.sqlValues = { ...sqlValues };
    }
    return {
      seq: index + 1,
      process_code: step.processCode,
      description: step.description ?? null,
      duration_min: step.runTime ?? null,
      setup_time: step.setupTime ?? null,
      wait_time: step.waitTime ?? null,
      routing_set_code: step.routingSetCode ?? metadata?.routingSetCode ?? null,
      variant_code: step.variantCode ?? metadata?.variantCode ?? null,
      primary_routing_code: step.primaryRoutingCode ?? metadata?.primaryRoutingCode ?? null,
      secondary_routing_code: step.secondaryRoutingCode ?? metadata?.secondaryRoutingCode ?? null,
      branch_code: step.branchCode ?? metadata?.branchCode ?? null,
      branch_label: step.branchLabel ?? metadata?.branchLabel ?? null,
      branch_path: step.branchPath ?? metadata?.branchPath ?? null,
      sql_values: sqlValues ?? null,
      metadata: metadata ?? undefined,
    };
  });

const buildConnections = (
  timeline: ReturnType<typeof useRoutingStore.getState>["timeline"],
  connections: ReturnType<typeof useRoutingStore.getState>["connections"],
) =>
  connections
    .filter((connection) => (connection.metadata?.createdBy ?? "auto") === "manual")
    .filter((connection) => {
      const ids = new Set(timeline.map((step) => step.id));
      return ids.has(connection.sourceNodeId) && ids.has(connection.targetNodeId);
    })
    .map((connection) => ({
      id: connection.id,
      source_node_id: connection.sourceNodeId,
      target_node_id: connection.targetNodeId,
      created_at: connection.metadata?.createdAt ?? new Date().toISOString(),
      created_by: "manual" as const,
    }));

export function useRoutingGroups() {
  const timeline = useRoutingStore((state) => state.timeline);
  const connections = useRoutingStore((state) => state.connections);
  const erpRequired = useRoutingStore((state) => state.erpRequired);
  const sourceItemCodes = useRoutingStore((state) => state.sourceItemCodes);
  const setSaving = useRoutingStore((state) => state.setSaving);
  const setLoading = useRoutingStore((state) => state.setLoading);
  const setDirty = useRoutingStore((state) => state.setDirty);
  const setActiveGroup = useRoutingStore((state) => state.setActiveGroup);
  const setLastSavedAt = useRoutingStore((state) => state.setLastSavedAt);
  const setValidationErrors = useRoutingStore((state) => state.setValidationErrors);
  const clearValidation = useRoutingStore((state) => state.clearValidation);
  const captureLastSuccess = useRoutingStore((state) => state.captureLastSuccess);
  const rollbackToLastSuccess = useRoutingStore((state) => state.rollbackToLastSuccess);
  const applyGroup = useRoutingStore((state) => state.applyGroup);
  const getRoutingSaveState = useWorkspaceStore((state) => state.saveRouting);

  const collectItemCodes = useCallback((): string[] => {
    const codes = new Set<string>();
    timeline.forEach((step) => {
      if (step.itemCode) {
        codes.add(step.itemCode);
      }
    });
    return codes.size > 0 ? Array.from(codes) : sourceItemCodes;
  }, [timeline, sourceItemCodes]);

  const saveGroup = useCallback(
    async ({ groupName, metadata }: SaveGroupArgs): Promise<SaveGroupResult> => {
      const trimmed = groupName.trim();
      if (!trimmed) {
        return { ok: false, message: "Enter a group name." };
      }
      if (timeline.length === 0) {
        return { ok: false, message: "Add steps to the timeline before saving." };
      }

      const steps = buildSteps(timeline);
      const manualConnections = buildConnections(timeline, connections);
      const itemCodes = collectItemCodes();
      const { columnMappings } = getRoutingSaveState();

      try {
        setSaving(true);
        clearValidation();
        const metadataPayload = { ...(metadata ?? { source: "codex-ui" }) } as Record<string, unknown>;
        if (columnMappings.length > 0) {
          metadataPayload.output_mappings = columnMappings;
          metadataPayload.output_mapping_count = columnMappings.length;
        }
        if (manualConnections.length > 0) {
          metadataPayload.manual_connections = manualConnections;
          metadataPayload.manual_connection_count = manualConnections.length;
        }
        // API removed - return mock response
        const response = {
          group_id: `group-${Date.now()}`,
          version: 1,
          updated_at: new Date().toISOString()
        } as RoutingGroupCreateResponse;
        // const response = await createRoutingGroup({
        //   groupName: trimmed,
        //   itemCodes,
        //   steps,
        //   erpRequired,
        //   metadata: metadataPayload,
        // });
        setActiveGroup({ id: response.group_id, name: trimmed, version: response.version, updatedAt: response.updated_at });
        setLastSavedAt(response.updated_at);
        captureLastSuccess();
        setDirty(false);
        // Audit API removed
        // await postUiAudit({
        //   action: "ui.routing.save",
        //   username: "codex",
        //   payload: {
        //     group_id: response.group_id,
        //     version: response.version,
        //     step_count: steps.length,
        //     erp_required: erpRequired,
        //   },
        // });
        return { ok: true, message: "Group saved successfully.", response };
      } catch (error) {
        rollbackToLastSuccess();
        let message = "Failed to save group.";
        if (axios.isAxiosError(error)) {
          const detail = error.response?.data?.detail ?? error.response?.data?.message;
          if (Array.isArray(detail)) {
            const messages = detail.map((value) => String(value));
            setValidationErrors(messages);
            message = messages.join("\n");
          } else if (detail) {
            const text = typeof detail === "string" ? detail : JSON.stringify(detail);
            setValidationErrors([text]);
            message = text;
          }
        }
        return { ok: false, message };
      } finally {
        setSaving(false);
      }
    },
    [
      captureLastSuccess,
      clearValidation,
      collectItemCodes,
      erpRequired,
      getRoutingSaveState,
      rollbackToLastSuccess,
      setActiveGroup,
      setDirty,
      setLastSavedAt,
      setSaving,
      setValidationErrors,
      connections,
      timeline,
    ],
  );

  const loadGroup = useCallback(
    async (groupId: string): Promise<LoadGroupResult> => {
      const trimmed = groupId.trim();
      if (!trimmed) {
        return { ok: false, message: "Enter a group ID." };
      }
      try {
        setLoading(true);
        // API removed - return error
        return { ok: false, message: "Routing groups loading feature not available in prediction-only mode." };
        // const detail = await fetchRoutingGroup(trimmed);
        // applyGroup(detail, "replace");
        // captureLastSuccess();
        // setDirty(false);
        // await postUiAudit({
        //   action: "ui.routing.load",
        //   username: "codex",
        //   payload: {
        //     group_id: detail.group_id,
        //     version: detail.version,
        //     item_count: detail.item_codes.length,
        //   },
        // });
        // return { ok: true, message: `Loaded group '${detail.group_name}'.`, detail };
      } catch (error) {
        let message = "Failed to load group.";
        if (axios.isAxiosError(error)) {
          const detail = error.response?.data?.detail ?? error.response?.data?.message;
          if (detail) {
            message = typeof detail === "string" ? detail : JSON.stringify(detail);
          }
          setValidationErrors([message]);
        }
        return { ok: false, message };
      } finally {
        setLoading(false);
      }
    },
    [applyGroup, captureLastSuccess, setDirty, setLoading, setValidationErrors],
  );

  const fetchGroups = useCallback(
    async (params?: { owner?: string; search?: string; limit?: number; offset?: number }): Promise<RoutingGroupListResponse> => {
      // API removed - return empty list
      return { items: [], pagination: { total: 0, limit: 0, offset: 0 } } as RoutingGroupListResponse;
      // return listRoutingGroups(params);
    },
    [],
  );

  return {
    saveGroup,
    loadGroup,
    fetchGroups,
  };
}

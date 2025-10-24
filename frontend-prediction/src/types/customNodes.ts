/**
 * Custom Process Nodes Type Definitions
 *
 * Phase 2: Frontend State Management
 */

/**
 * Custom process node data structure
 */
export interface CustomNode {
  id: string;
  user_id: string;
  process_code: string;
  process_name: string;
  estimated_time: number | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Payload for creating a new custom node
 */
export interface CustomNodeCreatePayload {
  process_code: string;
  process_name: string;
  estimated_time?: number | null;
  color?: string | null;
}

/**
 * Payload for updating an existing custom node
 */
export interface CustomNodeUpdatePayload {
  process_code?: string | null;
  process_name?: string | null;
  estimated_time?: number | null;
  color?: string | null;
}

/**
 * Response from custom nodes API
 */
export type CustomNodeResponse = CustomNode;

/**
 * List response from custom nodes API
 */
export type CustomNodesListResponse = CustomNode[];

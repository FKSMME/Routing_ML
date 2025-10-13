export interface MasterDataTreeNode {
  id: string;
  label: string;
  type: "group" | "family" | "item";
  children?: MasterDataTreeNode[];
  meta?: Record<string, string> | null;
}

export interface MasterDataTreeResponse {
  nodes: MasterDataTreeNode[];
  total_items: number;
  filtered_items: number;
  default_item_code?: string | null;
}

export interface MasterDataMatrixColumn {
  key: string;
  label: string;
  width?: string | null;
}

export interface MasterDataMatrixRow {
  key: string;
  values: Record<string, string>;
}

export interface MasterDataItemResponse {
  item_code: string;
  columns: MasterDataMatrixColumn[];
  rows: MasterDataMatrixRow[];
  record_count: number;
}

export interface MasterDataLogEntry {
  timestamp: string;
  ip: string;
  user: string;
  action: string;
  target: string;
}

export interface MasterDataConnectionStatus {
  status: "connected" | "disconnected";
  server?: string;
  database?: string;
  last_checked?: string | null;
}

export interface MasterDataLogsResponse {
  logs: MasterDataLogEntry[];
  connection: MasterDataConnectionStatus;
}

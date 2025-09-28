export interface MasterDataTreeNode {
  id: string;
  label: string;
  type: "group" | "family" | "item";
  children?: MasterDataTreeNode[];
  meta?: Record<string, string>;
}

export interface MasterDataMatrixColumn {
  key: string;
  label: string;
  width?: string;
}

export interface MasterDataMatrixRow {
  key: string;
  values: Record<string, string>;
}

export interface MasterDataLogEntry {
  timestamp: string;
  ip: string;
  user: string;
  action: string;
  target: string;
}

export interface MasterDataMockPayload {
  tree: MasterDataTreeNode[];
  columns: MasterDataMatrixColumn[];
  matrices: Record<string, MasterDataMatrixRow[]>;
  logs: MasterDataLogEntry[];
}

export const MASTER_DATA_MOCK: MasterDataMockPayload = {
  tree: [
    {
      id: "grp-valve",
      label: "Valve Assembly",
      type: "group",
      children: [
        {
          id: "fam-ball",
          label: "Ball Valve",
          type: "family",
          children: [
            {
              id: "ITEM-001",
              label: "ITEM-001 · 2in Ball Valve",
              type: "item",
              meta: {
                material: "A105",
                diameter: "DN50",
              },
            },
            {
              id: "ITEM-002",
              label: "ITEM-002 · 4in Ball Valve",
              type: "item",
              meta: {
                material: "CF8M",
                diameter: "DN100",
              },
            },
          ],
        },
        {
          id: "fam-gate",
          label: "Gate Valve",
          type: "family",
          children: [
            {
              id: "ITEM-003",
              label: "ITEM-003 · Gate Valve",
              type: "item",
              meta: {
                material: "WCB",
                diameter: "DN80",
              },
            },
          ],
        },
      ],
    },
    {
      id: "grp-pump",
      label: "Pump Assembly",
      type: "group",
      children: [
        {
          id: "fam-centrifugal",
          label: "Centrifugal Pump",
          type: "family",
          children: [
            {
              id: "ITEM-004",
              label: "ITEM-004 · 3-stage Centrifugal Pump",
              type: "item",
              meta: {
                material: "SS400",
                capacity: "45m3/h",
              },
            },
          ],
        },
      ],
    },
  ],
  columns: [
    { key: "itemCode", label: "품목코드", width: "140px" },
    { key: "material", label: "재질", width: "120px" },
    { key: "diameter", label: "치수" },
    { key: "process", label: "대표 공정" },
    { key: "erpMapping", label: "ERP 매핑" },
    { key: "lastUpdated", label: "최종 업데이트" },
  ],
  matrices: {
    'ITEM-001': [
      {
        key: "ITEM-001",
        values: {
          itemCode: "ITEM-001",
          material: "A105",
          diameter: "DN50",
          process: "Machining > Assembly > Inspection",
          erpMapping: "ERP_ROUTING_1240",
          lastUpdated: "2025-09-12 14:30",
        },
      },
    ],
    'ITEM-002': [
      {
        key: "ITEM-002",
        values: {
          itemCode: "ITEM-002",
          material: "CF8M",
          diameter: "DN100",
          process: "Casting > Machining > Inspection",
          erpMapping: "ERP_ROUTING_1388",
          lastUpdated: "2025-09-10 09:12",
        },
      },
    ],
    'ITEM-003': [
      {
        key: "ITEM-003",
        values: {
          itemCode: "ITEM-003",
          material: "WCB",
          diameter: "DN80",
          process: "Forging > Machining > Painting",
          erpMapping: "ERP_ROUTING_1750",
          lastUpdated: "2025-09-02 18:45",
        },
      },
    ],
    'ITEM-004': [
      {
        key: "ITEM-004",
        values: {
          itemCode: "ITEM-004",
          material: "SS400",
          diameter: "45m3/h",
          process: "Machining > Assembly > Balancing",
          erpMapping: "ERP_ROUTING_1950",
          lastUpdated: "2025-08-27 11:27",
        },
      },
    ],
  },
  logs: [
    {
      timestamp: "2025-09-28 15:22",
      ip: "10.20.14.22",
      user: "kim.jw",
      action: "search.master_data",
      target: "ITEM-001",
    },
    {
      timestamp: "2025-09-28 15:18",
      ip: "10.20.14.22",
      user: "kim.jw",
      action: "tree.expand",
      target: "grp-valve",
    },
    {
      timestamp: "2025-09-28 14:58",
      ip: "10.20.31.45",
      user: "park.sy",
      action: "favorites.pin",
      target: "ITEM-002",
    },
    {
      timestamp: "2025-09-28 14:42",
      ip: "10.20.31.45",
      user: "park.sy",
      action: "matrix.copy",
      target: "ITEM-004",
    },
  ],
};


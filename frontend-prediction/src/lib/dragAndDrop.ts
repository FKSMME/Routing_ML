export const ROUTING_ITEM_DRAG_MIME = "application/x-routing-itemcodes";

export interface ItemCodesDragPayload {
  items: string[];
  viewName?: string;
  columnName?: string;
  filterValue?: string | null;
  source?: string;
}

interface InternalDragPayload extends ItemCodesDragPayload {
  kind: "routing-itemcodes";
}

const INTERNAL_KIND = "routing-itemcodes";
const JSON_MIME = "application/json";
const TEXT_MIME = "text/plain";

const toArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }
      if (item === null || item === undefined) {
        return "";
      }
      return String(item).trim();
    })
    .filter((item) => item.length > 0);
};

const unique = (items: string[]): string[] => {
  return Array.from(new Set(items));
};

export function setItemCodesDragData(dataTransfer: DataTransfer, payload: ItemCodesDragPayload): void {
  const items = unique(toArray(payload.items));
  if (items.length === 0) {
    return;
  }

  const internalPayload: InternalDragPayload = {
    ...payload,
    items,
    kind: INTERNAL_KIND,
  };

  const json = JSON.stringify(internalPayload);

  try {
    dataTransfer.setData(ROUTING_ITEM_DRAG_MIME, json);
  } catch {
    // Ignore if custom MIME type is not supported.
  }

  try {
    dataTransfer.setData(JSON_MIME, json);
  } catch {
    // Ignore JSON fallback failure.
  }

  try {
    dataTransfer.setData(TEXT_MIME, items.join("\n"));
  } catch {
    // Ignore text fallback failure.
  }

  dataTransfer.effectAllowed = "copy";
}

const parseJsonPayload = (raw: string | null | undefined): InternalDragPayload | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<InternalDragPayload>;
    if (parsed && parsed.kind === INTERNAL_KIND && Array.isArray(parsed.items)) {
      return {
        kind: INTERNAL_KIND,
        items: unique(toArray(parsed.items)),
        viewName: parsed.viewName,
        columnName: parsed.columnName,
        filterValue: parsed.filterValue ?? null,
        source: parsed.source,
      };
    }
  } catch {
    // Ignore parsing errors.
  }
  return null;
};

export function readItemCodesDragData(dataTransfer: DataTransfer): ItemCodesDragPayload | null {
  let direct = "";
  try {
    direct = dataTransfer.getData(ROUTING_ITEM_DRAG_MIME);
  } catch {
    direct = "";
  }

  const byCustom = parseJsonPayload(direct);
  if (byCustom && byCustom.items.length > 0) {
    return byCustom;
  }

  let jsonRaw = "";
  try {
    jsonRaw = dataTransfer.getData(JSON_MIME);
  } catch {
    jsonRaw = "";
  }

  const byJson = parseJsonPayload(jsonRaw);

  if (byJson && byJson.items.length > 0) {
    return byJson;
  }

  let textRaw = "";
  try {
    textRaw = dataTransfer.getData(TEXT_MIME);
  } catch {
    textRaw = "";
  }

  const textItems = unique(
    textRaw
      .split(/[\r\n,;]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );

  if (textItems.length === 0) {
    return null;
  }

  return {
    items: textItems,
    source: "text/plain",
  };
}

export function hasItemCodesDragData(dataTransfer: DataTransfer): boolean {
  if (!dataTransfer.types || dataTransfer.types.length === 0) {
    return false;
  }
  const types = Array.from(dataTransfer.types);
  if (types.includes(ROUTING_ITEM_DRAG_MIME)) {
    return true;
  }
  if (types.includes(JSON_MIME)) {
    return true;
  }
  if (types.includes(TEXT_MIME)) {
    return true;
  }
  return false;
}

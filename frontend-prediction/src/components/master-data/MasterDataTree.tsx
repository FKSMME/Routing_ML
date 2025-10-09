import type { MasterDataTreeNode } from "@app-types/masterData";
import { fetchMasterDataTree } from "@lib/apiClient";
import { useCallback, useEffect, useMemo, useState } from "react";

interface MasterDataTreeProps {
  nodes: MasterDataTreeNode[];
  query?: string;
  activeId: string | null;
  onSelect: (id: string) => void;
}

type TreeNodeState = MasterDataTreeNode & {
  children: TreeNodeState[];
  isExpanded: boolean;
  isLoading: boolean;
  hasLoadedChildren: boolean;
};

const createStateNode = (node: MasterDataTreeNode): TreeNodeState => {
  const childStates = node.children ? node.children.map(createStateNode) : [];
  return {
    ...node,
    children: childStates,
    isExpanded: false,
    isLoading: false,
    hasLoadedChildren: childStates.length > 0,
  };
};

const createStateNodes = (nodeList: MasterDataTreeNode[]): TreeNodeState[] => nodeList.map(createStateNode);

const mapNodes = (
  nodes: TreeNodeState[],
  targetId: string,
  updater: (node: TreeNodeState) => TreeNodeState,
): TreeNodeState[] => {
  let changed = false;
  const nextNodes = nodes.map((node) => {
    if (node.id === targetId) {
      changed = true;
      return updater(node);
    }
    if (node.children.length > 0) {
      const childResult = mapNodes(node.children, targetId, updater);
      if (childResult !== node.children) {
        changed = true;
        return { ...node, children: childResult };
      }
    }
    return node;
  });
  return changed ? nextNodes : nodes;
};

interface TreeNodeProps {
  node: TreeNodeState;
  activeId: string | null;
  onSelect: (id: string) => void;
  onToggle: (node: TreeNodeState) => void;
}

function TreeNode({ node, activeId, onSelect, onToggle }: TreeNodeProps) {
  const isItem = node.type === "item";
  const isActive = node.id === activeId;
  const metaEntries = node.meta ? Object.entries(node.meta) : [];
  const title = metaEntries.length ? metaEntries.map(([key, value]) => `${key}: ${value}`).join(" | ") : undefined;
  const parseCount = (value?: string | null) => {
    if (value == null) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const itemCount = parseCount(node.meta?.item_count ?? node.meta?.filtered_items ?? "0");
  const familyCount = parseCount(node.meta?.family_count ?? "0");
  const canToggle = !isItem && (node.hasLoadedChildren || familyCount > 0 || itemCount > 0);
  const className = ["master-tree-node", `master-tree-node-${node.type}`, isActive ? "is-active" : ""].join(" ").trim();

  return (
    <li data-node={node.id} data-node-type={node.type}>
      <div className="master-tree-row">
        {canToggle ? (
          <button
            type="button"
            className="master-tree-toggle"
            onClick={() => onToggle(node)}
            aria-expanded={node.isExpanded}
            disabled={node.isLoading}
          >
            <span aria-hidden>{node.isLoading ? "…" : node.isExpanded ? "−" : "+"}</span>
            <span className="sr-only">Toggle {node.label}</span>
          </button>
        ) : (
          <span className="master-tree-toggle master-tree-toggle--spacer" aria-hidden />
        )}
        <button
          type="button"
          className={className}
          onClick={() => {
            if (isItem) {
              onSelect(node.id);
            } else if (canToggle) {
              onToggle(node);
            }
          }}
          title={title}
          aria-pressed={isActive}
        >
          <span className="master-tree-label">{node.label}</span>
        </button>
      </div>
      {metaEntries.length > 0 ? (
        <dl className="master-tree-meta">
          {metaEntries.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {node.isExpanded ? (
        <div className="master-tree-branch">
          {node.isLoading ? (
            <p className="master-tree-status">Loading…</p>
          ) : node.children.length > 0 ? (
            <ul className="master-tree-children">
              {node.children.map((child: TreeNodeState) => (
                <TreeNode key={child.id} node={child} activeId={activeId} onSelect={onSelect} onToggle={onToggle} />
              ))}
            </ul>
          ) : (
            <p className="master-tree-status">No records found.</p>
          )}
        </div>
      ) : null}
    </li>
  );
}

export function MasterDataTree({ nodes, query, activeId, onSelect }: MasterDataTreeProps) {
  const [treeState, setTreeState] = useState<TreeNodeState[]>([]);

  useEffect(() => {
    setTreeState((previous) => {
      if (nodes.length === 0) {
        return [];
      }
      const previousMap = new Map(previous.map((node) => [node.id, node]));
      return nodes.map((node) => {
        const existing = previousMap.get(node.id);
        if (existing) {
          let nextChildren = existing.children;
          let nextHasLoadedChildren = existing.hasLoadedChildren;
          if (node.children && node.children.length > 0) {
            nextChildren = createStateNodes(node.children);
            nextHasLoadedChildren = true;
          }
          return {
            ...existing,
            ...node,
            children: nextChildren,
            isLoading: false,
            hasLoadedChildren:
              nextHasLoadedChildren || nextChildren.length > 0 || Boolean(node.children?.length),
          };
        }
        return createStateNode(node);
      });
    });
  }, [nodes]);

  const normalizedQuery = useMemo(() => query?.trim() ?? "", [query]);

  const updateNode = useCallback((id: string, updater: (node: TreeNodeState) => TreeNodeState) => {
    setTreeState((prev) => mapNodes(prev, id, updater));
  }, []);

  const loadChildren = useCallback(
    async (node: TreeNodeState) => {
      updateNode(node.id, (current) => ({ ...current, isLoading: true }));
      try {
        const response = await fetchMasterDataTree(
          normalizedQuery || undefined,
          node.type,
          node.id
        );
        const childStates = createStateNodes(response.nodes);
        updateNode(node.id, (current) => ({
          ...current,
          children: childStates,
          isExpanded: true,
          isLoading: false,
          hasLoadedChildren: true,
        }));
      } catch (error) {
        console.error("Failed to load master data tree nodes", error);
        updateNode(node.id, (current) => ({ ...current, isLoading: false }));
      }
    },
    [normalizedQuery, updateNode],
  );

  const handleToggle = useCallback(
    (node: TreeNodeState) => {
      if (node.type === "item") {
        onSelect(node.id);
        return;
      }
      if (node.isLoading) {
        return;
      }
      if (node.hasLoadedChildren) {
        updateNode(node.id, (current) => ({ ...current, isExpanded: !current.isExpanded }));
        return;
      }
      void loadChildren(node);
    },
    [loadChildren, onSelect, updateNode],
  );

  return (
    <section className="panel-card interactive-card master-tree-panel" aria-label="Master data tree">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">Item hierarchy</h2>
          <p className="panel-subtitle">Siemens Teamcenter style grouping</p>
        </div>
      </header>
      <div className="master-tree">
        <ul className="master-tree-root">
          {treeState.map((node) => (
            <TreeNode key={node.id} node={node} activeId={activeId} onSelect={onSelect} onToggle={handleToggle} />
          ))}
        </ul>
      </div>
    </section>
  );
}

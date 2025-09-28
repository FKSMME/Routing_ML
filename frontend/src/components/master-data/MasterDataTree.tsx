import type { MasterDataTreeNode } from "@app-types/masterData";

interface MasterDataTreeProps {
  nodes: MasterDataTreeNode[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

function TreeNode({ node, activeId, onSelect }: { node: MasterDataTreeNode; activeId: string | null; onSelect: (id: string) => void }) {
  const isItem = node.type === "item";
  const isActive = node.id === activeId;
  const className = ["master-tree-node", `master-tree-node-${node.type}`, isActive ? "is-active" : ""].join(" ").trim();
  const metaEntries = node.meta ? Object.entries(node.meta) : [];
  const title = metaEntries.length ? metaEntries.map(([key, value]) => `${key}: ${value}`).join(" | ") : undefined;

  return (
    <li data-node={node.id} data-node-type={node.type}>
      <button
        type="button"
        className={className}
        onClick={() => {
          if (isItem) {
            onSelect(node.id);
          }
        }}
        title={title}
        aria-pressed={isActive}
      >
        <span className="master-tree-label">{node.label}</span>
      </button>
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
      {node.children && node.children.length > 0 ? (
        <ul className="master-tree-children">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} activeId={activeId} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function MasterDataTree({ nodes, activeId, onSelect }: MasterDataTreeProps) {
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
          {nodes.map((node) => (
            <TreeNode key={node.id} node={node} activeId={activeId} onSelect={onSelect} />
          ))}
        </ul>
      </div>
    </section>
  );
}

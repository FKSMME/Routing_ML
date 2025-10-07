/**
 * Simplified Master Data Workspace
 * Left 20%: Item_CD list with search
 * Right 80%: 50+ columns in 4-column grid layout
 */
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { fetchMasterDataTree, fetchMasterDataItem } from "@lib/apiClient";
import type { MasterDataTreeNode, MasterDataMatrixRow } from "@app-types/masterData";

interface ItemFeature {
  label: string;
  value: string | number | null;
  key: string;
}

export function MasterDataSimpleWorkspace() {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<MasterDataTreeNode[]>([]);
  const [selectedItemCode, setSelectedItemCode] = useState<string | null>(null);
  const [features, setFeatures] = useState<ItemFeature[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(false);

  // Load item list from tree API
  const loadItemList = useCallback(async (searchQuery?: string) => {
    setIsLoadingList(true);
    try {
      const response = await fetchMasterDataTree({ query: searchQuery });
      // Flatten all items from all groups
      const allItems: MasterDataTreeNode[] = [];
      const extractItems = (nodes: MasterDataTreeNode[]) => {
        nodes.forEach((node) => {
          if (node.type === "item") {
            allItems.push(node);
          }
          if (node.children && node.children.length > 0) {
            extractItems(node.children);
          }
        });
      };
      extractItems(response.nodes);
      setItems(allItems);
    } catch (error) {
      console.error("Failed to load item list:", error);
      setItems([]);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  // Load features for selected item
  const loadItemFeatures = useCallback(async (itemCode: string) => {
    setIsLoadingFeatures(true);
    try {
      const response = await fetchMasterDataItem(itemCode);

      // Extract features from the first row (item master data)
      if (response.rows.length > 0) {
        const row = response.rows[0];
        const featureList: ItemFeature[] = response.columns.map((col) => ({
          label: col.label,
          value: row.values[col.key] ?? null,
          key: col.key,
        }));
        setFeatures(featureList);
      } else {
        setFeatures([]);
      }
    } catch (error) {
      console.error("Failed to load item features:", error);
      setFeatures([]);
    } finally {
      setIsLoadingFeatures(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadItemList();
  }, [loadItemList]);

  // Load features when item is selected
  useEffect(() => {
    if (selectedItemCode) {
      void loadItemFeatures(selectedItemCode);
    } else {
      setFeatures([]);
    }
  }, [selectedItemCode, loadItemFeatures]);

  // Search handler with debouncing
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    const timer = setTimeout(() => {
      void loadItemList(value || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [loadItemList]);

  // Filter items by search
  const filteredItems = search.trim()
    ? items.filter((item) =>
        item.id.toLowerCase().includes(search.toLowerCase()) ||
        item.label.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div className="master-data-simple-workspace">
      {/* Left Panel: 20% - Item List */}
      <aside className="master-data-simple-left">
        <div className="panel-card">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">품목 목록</h2>
              <p className="panel-subtitle">{filteredItems.length}개 품목</p>
            </div>
          </header>

          {/* Search Input */}
          <div className="master-data-simple-search">
            <div className="input-group">
              <Search size={16} className="input-icon" />
              <input
                type="text"
                className="input-with-icon"
                placeholder="품목 코드 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Item List */}
          <div className="master-data-simple-list">
            {isLoadingList ? (
              <p className="text-sm text-muted p-4">로딩 중...</p>
            ) : filteredItems.length === 0 ? (
              <p className="text-sm text-muted p-4">품목이 없습니다.</p>
            ) : (
              <ul className="master-data-simple-items">
                {filteredItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`master-data-simple-item ${
                        selectedItemCode === item.id ? "is-active" : ""
                      }`}
                      onClick={() => setSelectedItemCode(item.id)}
                    >
                      <span className="item-code">{item.id}</span>
                      <span className="item-name text-muted">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>

      {/* Right Panel: 80% - Feature Grid */}
      <section className="master-data-simple-right">
        <div className="panel-card">
          <header className="panel-header">
            <div>
              <h2 className="panel-title">
                {selectedItemCode ? `${selectedItemCode} 상세 정보` : "품목 정보"}
              </h2>
              <p className="panel-subtitle">
                {selectedItemCode
                  ? `${features.length}개 속성`
                  : "좌측에서 품목을 선택하세요"}
              </p>
            </div>
          </header>

          {isLoadingFeatures ? (
            <div className="p-8 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <p className="mt-2 text-sm text-muted">정보를 불러오는 중...</p>
            </div>
          ) : !selectedItemCode ? (
            <div className="p-8 text-center text-muted">
              <p>품목을 선택하면 상세 정보가 표시됩니다.</p>
            </div>
          ) : features.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <p>데이터가 없습니다.</p>
            </div>
          ) : (
            <div className="master-data-simple-grid">
              {features.map((feature) => (
                <div key={feature.key} className="master-data-simple-field">
                  <label className="field-label">{feature.label}</label>
                  <div className="field-value">
                    {feature.value !== null && feature.value !== ""
                      ? String(feature.value)
                      : "-"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

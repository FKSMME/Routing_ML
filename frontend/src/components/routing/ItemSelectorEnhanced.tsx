import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface PurchaseOrderItem {
  ITEM_CD: string;
  PO_NO: string;
  PO_DATE: string;
  QTY: number;
  VENDOR_NM: string;
}

interface ItemProperties {
  basic_info: {
    ITEM_CD: string;
    ITEM_NM: string;
    ITEM_SPEC: string;
    UNIT: string;
    ITEM_TYPE: string;
    DRAW_MP?: string;  // 도면 번호
  };
  classification: {
    ITEM_GRP1: string;
    ITEM_GRP1NM: string;
    ITEM_GRP2: string;
    ITEM_GRP2NM: string;
    ITEM_GRP3: string;
    ITEM_GRP3NM: string;
  };
  purchase_info: {
    PO_COUNT?: number;
    LATEST_PO_NO?: string;
    LATEST_PO_DATE?: string;
    LATEST_QTY?: number;
    LATEST_VENDOR_NM?: string;
  };
}

interface ItemSelectorProps {
  onItemSelect: (itemCode: string, properties: ItemProperties) => void;
  apiBaseUrl?: string;
}

export function ItemSelector({ onItemSelect, apiBaseUrl = '/api' }: ItemSelectorProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [itemProperties, setItemProperties] = useState<ItemProperties | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 발주 품목 목록 로드
  useEffect(() => {
    loadPurchaseOrders();
  }, []);

  const loadPurchaseOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/items/purchase-orders?limit=200`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to load purchase orders: ${response.statusText}`);
      }

      const data = await response.json();
      setPurchaseOrders(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to load purchase orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadItemProperties = async (itemCode: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/items/${itemCode}/properties`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to load item properties: ${response.statusText}`);
      }

      const properties = await response.json();
      setItemProperties(properties);
      onItemSelect(itemCode, properties);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Failed to load item properties:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const itemCode = event.target.value;
    setSelectedItem(itemCode);

    if (itemCode) {
      loadItemProperties(itemCode);
    } else {
      setItemProperties(null);
    }
  };

  const handleDirectInput = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const itemCode = searchQuery.trim().toUpperCase();

    if (itemCode) {
      setSelectedItem(itemCode);
      loadItemProperties(itemCode);
    }
  };

  // 도면 열람 버튼 핸들러
  const handleOpenDrawing = () => {
    if (!itemProperties?.basic_info.DRAW_MP) {
      alert('도면 번호가 없습니다.');
      return;
    }

    const drawMp = itemProperties.basic_info.DRAW_MP;
    const url = `https://img.ksm.co.kr/WebViewer/View/Main.aspx?doc=${encodeURIComponent(drawMp)}`;

    // 새 창으로 도면 뷰어 열기
    window.open(url, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
  };

  // 검색 필터링
  const filteredOrders = purchaseOrders.filter(order =>
    order.ITEM_CD?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.VENDOR_NM?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="item-selector">
      <div className="panel-card">
        <header className="panel-header">
          <div>
            <h2 className="panel-title">품목 선택</h2>
            <p className="panel-subtitle">발주 데이터에서 품목을 선택하거나 직접 입력하세요</p>
          </div>
        </header>

        <div className="item-selector__content">
          {/* 직접 입력 */}
          <form onSubmit={handleDirectInput} className="item-selector__search-form">
            <label htmlFor="item-search" className="item-selector__label">
              품목 코드 검색/입력
            </label>
            <div className="item-selector__search-group">
              <input
                id="item-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="품목 코드를 입력하세요 (예: PROD-A-001)"
                className="item-selector__input"
              />
              <button type="submit" className="btn-secondary">
                조회
              </button>
            </div>
          </form>

          {/* 발주 품목 드롭다운 */}
          <div className="item-selector__dropdown-group">
            <label htmlFor="item-dropdown" className="item-selector__label">
              발주 품목 목록
            </label>
            <div className="item-selector__select-with-button">
              <select
                id="item-dropdown"
                value={selectedItem}
                onChange={handleItemChange}
                disabled={loading}
                className="item-selector__select"
              >
                <option value="">-- 품목을 선택하세요 --</option>
                {filteredOrders.map((order) => (
                  <option key={`${order.ITEM_CD}-${order.PO_NO}`} value={order.ITEM_CD}>
                    {order.ITEM_CD} | PO: {order.PO_NO} | {order.VENDOR_NM} ({order.PO_DATE})
                  </option>
                ))}
              </select>

              {/* 도면 열람 버튼 - ItemCd 옆에 배치 */}
              <button
                type="button"
                onClick={handleOpenDrawing}
                disabled={!selectedItem || !itemProperties?.basic_info.DRAW_MP}
                className="btn-icon btn-drawing"
                title="도면 열람"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <span>도면 열람</span>
              </button>
            </div>
            <p className="item-selector__hint">
              총 {filteredOrders.length}개 품목 / {purchaseOrders.length}개 발주
            </p>
          </div>

          {/* 로딩/에러 상태 */}
          {loading && (
            <div className="item-selector__status item-selector__status--loading">
              품목 정보 로드 중...
            </div>
          )}

          {error && (
            <div className="item-selector__status item-selector__status--error">
              오류: {error}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .item-selector__content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .item-selector__search-form,
        .item-selector__dropdown-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .item-selector__label {
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--text-primary);
        }

        .item-selector__search-group {
          display: flex;
          gap: 0.5rem;
        }

        .item-selector__select-with-button {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .item-selector__input,
        .item-selector__select {
          flex: 1;
          padding: 0.625rem 0.875rem;
          border: 1px solid var(--border-light);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background: var(--surface-base);
          color: var(--text-primary);
        }

        .item-selector__input:focus,
        .item-selector__select:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .item-selector__select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-drawing {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .btn-drawing:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-drawing:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-drawing:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-drawing svg {
          flex-shrink: 0;
        }

        .item-selector__hint {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin: 0;
        }

        .item-selector__status {
          padding: 0.75rem 1rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }

        .item-selector__status--loading {
          background: var(--info-bg);
          color: var(--info-text);
          border: 1px solid var(--info-border);
        }

        .item-selector__status--error {
          background: var(--error-bg);
          color: var(--error-text);
          border: 1px solid var(--error-border);
        }
      `}</style>
    </div>
  );
}

interface ItemPropertiesPanelProps {
  properties: ItemProperties | null;
}

export function ItemPropertiesPanel({ properties }: ItemPropertiesPanelProps) {
  if (!properties) {
    return (
      <div className="panel-card">
        <div className="panel-header">
          <h2 className="panel-title">품목 속성</h2>
          <p className="panel-subtitle">품목을 선택하면 속성 정보가 표시됩니다</p>
        </div>
      </div>
    );
  }

  const PropertyRow = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="property-row">
      <span className="property-label">{label}</span>
      <span className="property-value">{value || '-'}</span>
    </div>
  );

  return (
    <div className="panel-card">
      <div className="panel-header">
        <h2 className="panel-title">품목 속성</h2>
        <p className="panel-subtitle">{properties.basic_info.ITEM_CD}</p>
      </div>

      <div className="properties-panel__content">
        {/* 기본 정보 */}
        <section className="property-section">
          <h3 className="property-section__title">기본 정보</h3>
          <PropertyRow label="품목명" value={properties.basic_info.ITEM_NM} />
          <PropertyRow label="규격" value={properties.basic_info.ITEM_SPEC} />
          <PropertyRow label="단위" value={properties.basic_info.UNIT} />
          <PropertyRow label="품목 유형" value={properties.basic_info.ITEM_TYPE} />
          {properties.basic_info.DRAW_MP && (
            <PropertyRow label="도면 번호" value={properties.basic_info.DRAW_MP} />
          )}
        </section>

        {/* 분류 정보 */}
        <section className="property-section">
          <h3 className="property-section__title">분류 정보</h3>
          <PropertyRow
            label="품목 그룹 1"
            value={`${properties.classification.ITEM_GRP1} (${properties.classification.ITEM_GRP1NM})`}
          />
          <PropertyRow
            label="품목 그룹 2"
            value={`${properties.classification.ITEM_GRP2} (${properties.classification.ITEM_GRP2NM})`}
          />
          <PropertyRow
            label="품목 그룹 3"
            value={`${properties.classification.ITEM_GRP3} (${properties.classification.ITEM_GRP3NM})`}
          />
        </section>

        {/* 발주 정보 */}
        {properties.purchase_info.PO_COUNT && properties.purchase_info.PO_COUNT > 0 && (
          <section className="property-section">
            <h3 className="property-section__title">최근 발주 정보</h3>
            <PropertyRow label="발주 건수" value={properties.purchase_info.PO_COUNT} />
            <PropertyRow label="발주 번호" value={properties.purchase_info.LATEST_PO_NO} />
            <PropertyRow label="발주 일자" value={properties.purchase_info.LATEST_PO_DATE} />
            <PropertyRow label="수량" value={properties.purchase_info.LATEST_QTY} />
            <PropertyRow label="공급업체" value={properties.purchase_info.LATEST_VENDOR_NM} />
          </section>
        )}
      </div>

      <style jsx>{`
        .properties-panel__content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .property-section {
          border: 1px solid var(--border-light);
          border-radius: 0.5rem;
          padding: 1rem;
          background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
        }

        .property-section__title {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 0.75rem 0;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-light);
        }

        .property-row {
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 1rem;
          padding: 0.5rem 0;
          font-size: 0.875rem;
        }

        .property-row:not(:last-child) {
          border-bottom: 1px solid var(--border-lightest);
        }

        .property-label {
          color: var(--text-muted);
          font-weight: 500;
        }

        .property-value {
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}

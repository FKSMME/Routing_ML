import { useState } from 'react';
import { ColumnCustomizer, type ColumnConfig } from './ColumnCustomizer';

interface RoutingRow {
  routing_code: string;
  item_code: string;
  seq: number;
  required?: string;
  size?: string;
  front_milling?: string;
  machining_end?: string;
  side_milling?: string;
  opening?: string;
  machining_surface?: string;
  when_needed?: string;
  side_loading?: string;
  layup?: string;
  key?: string;
  coating?: string;
  '배움'?: string;
  powder?: string;
  pin?: string;
  remark?: string;
  created_at?: string;
  updated_at?: string;
}

interface RoutingDataTableProps {
  data: RoutingRow[];
  loading?: boolean;
}

export function RoutingDataTable({ data, loading = false }: RoutingDataTableProps) {
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>([]);

  const visibleColumns = columnConfig.filter(col => col.visible);

  const handleColumnApply = (columns: ColumnConfig[]) => {
    setColumnConfig(columns);
    console.log('컬럼 설정 적용됨:', columns.filter(c => c.visible).map(c => c.label));
  };

  return (
    <div className="routing-data-table">
      <div className="card-cute">
        {/* 헤더 */}
        <header className="panel-header">
          <div>
            <h2 className="panel-title">📊 라우팅 데이터</h2>
            <p className="panel-subtitle">
              {data.length}개 라우팅 | {visibleColumns.length}개 컬럼 표시 중
            </p>
          </div>
          <ColumnCustomizer onApply={handleColumnApply} />
        </header>

        {/* 테이블 */}
        <div className="routing-data-table__wrapper">
          {loading ? (
            <div className="loading-container">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p>데이터 로딩 중...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="empty-state">
              <p>📭 표시할 데이터가 없습니다</p>
            </div>
          ) : visibleColumns.length === 0 ? (
            <div className="empty-state">
              <p>🎛️ 표시할 컬럼을 선택해주세요</p>
            </div>
          ) : (
            <table className="routing-data-table__table">
              <thead>
                <tr>
                  {visibleColumns.map((col) => (
                    <th key={col.id}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={index}>
                    {visibleColumns.map((col) => (
                      <td key={col.id}>
                        {row[col.id as keyof RoutingRow] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style jsx>{`
        .routing-data-table__wrapper {
          overflow-x: auto;
          max-height: 600px;
          overflow-y: auto;
        }

        .routing-data-table__table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 0.875rem;
        }

        .routing-data-table__table thead {
          position: sticky;
          top: 0;
          z-index: 10;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .routing-data-table__table th {
          padding: 0.75rem 1rem;
          text-align: left;
          font-weight: 600;
          color: white;
          white-space: nowrap;
          border-bottom: 2px solid rgba(255, 255, 255, 0.2);
        }

        .routing-data-table__table th:first-child {
          border-top-left-radius: 0.5rem;
        }

        .routing-data-table__table th:last-child {
          border-top-right-radius: 0.5rem;
        }

        .routing-data-table__table tbody tr {
          transition: all 0.2s;
        }

        .routing-data-table__table tbody tr:hover {
          background: var(--surface-hover);
        }

        .routing-data-table__table tbody tr:nth-child(even) {
          background: rgba(0, 0, 0, 0.02);
        }

        .routing-data-table__table tbody tr:nth-child(even):hover {
          background: var(--surface-hover);
        }

        .routing-data-table__table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border-lightest);
          color: var(--text-primary);
          white-space: nowrap;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          gap: 1rem;
        }

        .loading-container p {
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .empty-state p {
          margin: 0;
        }
      `}</style>
    </div>
  );
}

export type { RoutingRow };

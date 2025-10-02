import { useState, useEffect } from 'react';

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  category: 'basic' | 'process' | 'quality' | 'material' | 'additional';
}

interface ColumnCustomizerProps {
  onApply: (columns: ColumnConfig[]) => void;
  storageKey?: string;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  // 기본 정보
  { id: 'routing_code', label: '라우팅 코드', visible: true, category: 'basic' },
  { id: 'item_code', label: '품목 코드', visible: true, category: 'basic' },
  { id: 'seq', label: '순서', visible: true, category: 'basic' },

  // 공정 정보
  { id: 'required', label: '필수지정', visible: true, category: 'process' },
  { id: 'size', label: '사이즈', visible: true, category: 'process' },
  { id: 'front_milling', label: '정면밀링', visible: true, category: 'process' },
  { id: 'machining_end', label: '가공단', visible: true, category: 'process' },
  { id: 'side_milling', label: '측면밀링', visible: true, category: 'process' },
  { id: 'opening', label: '열림', visible: true, category: 'process' },
  { id: 'machining_surface', label: '가공면', visible: true, category: 'process' },
  { id: 'when_needed', label: '필요시', visible: true, category: 'process' },
  { id: 'side_loading', label: '측면적재', visible: true, category: 'process' },

  // 품질/후처리
  { id: 'layup', label: '레이업', visible: true, category: 'quality' },
  { id: 'key', label: '열쇠', visible: true, category: 'quality' },
  { id: 'coating', label: '코팅', visible: true, category: 'quality' },
  { id: '배움', label: '배움', visible: true, category: 'quality' },
  { id: 'powder', label: '분체', visible: true, category: 'quality' },
  { id: 'pin', label: '핀', visible: true, category: 'quality' },

  // 추가 정보
  { id: 'remark', label: '비고', visible: false, category: 'additional' },
  { id: 'created_at', label: '생성일', visible: false, category: 'additional' },
  { id: 'updated_at', label: '수정일', visible: false, category: 'additional' },
];

const CATEGORY_LABELS = {
  basic: '기본 정보',
  process: '공정 정보',
  quality: '품질/후처리',
  material: '자재 정보',
  additional: '추가 정보',
};

export function ColumnCustomizer({
  onApply,
  storageKey = 'routing_column_config'
}: ColumnCustomizerProps) {
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 로컬 스토리지에서 설정 로드
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ColumnConfig[];
        setColumns(parsed);
      } catch (e) {
        console.error('컬럼 설정 로드 실패:', e);
      }
    }
  }, [storageKey]);

  const handleToggle = (columnId: string) => {
    setColumns(prev =>
      prev.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const handleSelectAll = () => {
    setColumns(prev => prev.map(col => ({ ...col, visible: true })));
  };

  const handleDeselectAll = () => {
    setColumns(prev => prev.map(col => ({ ...col, visible: false })));
  };

  const handleReset = () => {
    setColumns(DEFAULT_COLUMNS);
    localStorage.removeItem(storageKey);
  };

  const handleApply = () => {
    // 로컬 스토리지에 저장
    localStorage.setItem(storageKey, JSON.stringify(columns));
    onApply(columns);
    setIsOpen(false);
  };

  // 카테고리별 그룹화
  const groupedColumns = columns.reduce((acc, col) => {
    if (!acc[col.category]) {
      acc[col.category] = [];
    }
    acc[col.category].push(col);
    return acc;
  }, {} as Record<string, ColumnConfig[]>);

  // 검색 필터링
  const filteredColumns = searchQuery
    ? columns.filter(col =>
        col.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  const visibleCount = columns.filter(col => col.visible).length;

  return (
    <div className="column-customizer">
      {/* 토글 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-pastel-blue column-customizer__toggle"
        title="컬럼 설정"
      >
        🎛️ 컬럼 설정 ({visibleCount}/{columns.length})
      </button>

      {/* 모달 */}
      {isOpen && (
        <div className="column-customizer__overlay" onClick={() => setIsOpen(false)}>
          <div
            className="column-customizer__modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <header className="column-customizer__header">
              <div>
                <h2 className="column-customizer__title">컬럼 표시 설정</h2>
                <p className="column-customizer__subtitle">
                  표시할 컬럼을 선택하세요 ({visibleCount}개 선택됨)
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="column-customizer__close"
                aria-label="닫기"
              >
                ✕
              </button>
            </header>

            {/* 검색 및 일괄 조작 */}
            <div className="column-customizer__controls">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 컬럼 검색..."
                className="column-customizer__search"
              />

              <div className="column-customizer__actions">
                <button onClick={handleSelectAll} className="btn-text-sm">
                  전체 선택
                </button>
                <button onClick={handleDeselectAll} className="btn-text-sm">
                  전체 해제
                </button>
                <button onClick={handleReset} className="btn-text-sm text-danger">
                  초기화
                </button>
              </div>
            </div>

            {/* 컬럼 목록 */}
            <div className="column-customizer__content">
              {filteredColumns ? (
                // 검색 모드
                <div className="column-customizer__group">
                  <h3 className="column-customizer__group-title">검색 결과</h3>
                  <div className="column-customizer__list">
                    {filteredColumns.map((col) => (
                      <label key={col.id} className="column-customizer__item">
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => handleToggle(col.id)}
                          className="column-customizer__checkbox"
                        />
                        <span className="column-customizer__label">{col.label}</span>
                        <span className="column-customizer__category">
                          {CATEGORY_LABELS[col.category]}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                // 카테고리 그룹 모드
                Object.entries(groupedColumns).map(([category, cols]) => (
                  <div key={category} className="column-customizer__group">
                    <h3 className="column-customizer__group-title">
                      {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                      <span className="column-customizer__count">
                        {cols.filter(c => c.visible).length}/{cols.length}
                      </span>
                    </h3>
                    <div className="column-customizer__list">
                      {cols.map((col) => (
                        <label key={col.id} className="column-customizer__item">
                          <input
                            type="checkbox"
                            checked={col.visible}
                            onChange={() => handleToggle(col.id)}
                            className="column-customizer__checkbox"
                          />
                          <span className="column-customizer__label">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 푸터 */}
            <footer className="column-customizer__footer">
              <button
                onClick={() => setIsOpen(false)}
                className="btn-secondary"
              >
                취소
              </button>
              <button
                onClick={handleApply}
                className="btn-pastel-green"
              >
                적용
              </button>
            </footer>
          </div>
        </div>
      )}

      <style jsx>{`
        .column-customizer {
          position: relative;
        }

        .column-customizer__toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .column-customizer__overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .column-customizer__modal {
          background: var(--surface-base);
          border-radius: 1rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          width: 100%;
          max-width: 700px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .column-customizer__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1.5rem;
          border-bottom: 1px solid var(--border-light);
        }

        .column-customizer__title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 0.25rem 0;
        }

        .column-customizer__subtitle {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin: 0;
        }

        .column-customizer__close {
          background: none;
          border: none;
          font-size: 1.5rem;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0;
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.375rem;
          transition: all 0.2s;
        }

        .column-customizer__close:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .column-customizer__controls {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--border-light);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .column-customizer__search {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: 1px solid var(--border-light);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background: var(--surface-base);
          color: var(--text-primary);
        }

        .column-customizer__search:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .column-customizer__actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .btn-text-sm {
          background: none;
          border: none;
          color: var(--accent-primary);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          transition: all 0.2s;
        }

        .btn-text-sm:hover {
          background: var(--surface-hover);
        }

        .btn-text-sm.text-danger {
          color: var(--error-text);
        }

        .column-customizer__content {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .column-customizer__group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .column-customizer__group-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .column-customizer__count {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .column-customizer__list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .column-customizer__item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .column-customizer__item:hover {
          background: var(--surface-hover);
        }

        .column-customizer__checkbox {
          width: 1.125rem;
          height: 1.125rem;
          cursor: pointer;
          accent-color: var(--accent-primary);
        }

        .column-customizer__label {
          flex: 1;
          font-size: 0.875rem;
          color: var(--text-primary);
        }

        .column-customizer__category {
          font-size: 0.75rem;
          color: var(--text-muted);
          padding: 0.25rem 0.5rem;
          background: var(--surface-overlay);
          border-radius: 0.25rem;
        }

        .column-customizer__footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border-light);
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }

        .btn-secondary {
          padding: 0.625rem 1.25rem;
          background: var(--surface-hover);
          color: var(--text-primary);
          border: 1px solid var(--border-light);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: var(--surface-overlay);
        }
      `}</style>
    </div>
  );
}

export type { ColumnConfig };

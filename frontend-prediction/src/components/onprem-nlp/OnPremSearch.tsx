/**
 * On-Premises Natural Language Search Component
 *
 * 규칙 기반 NLP를 사용한 자연어 검색 (외부 API 의존성 없음)
 * 예상 정확도: 70-75%
 */

import React, { useState } from 'react';
import './OnPremSearch.css';

// ============================================================================
// Types
// ============================================================================

interface OnPremNLPResponse {
  filters: {
    material_code?: string;
    part_type?: string;
    inner_diameter_min?: number;
    inner_diameter_max?: number;
    outer_diameter_min?: number;
    outer_diameter_max?: number;
    thickness_min?: number;
    thickness_max?: number;
    drawing_number?: string;
    is_standard?: boolean;
  };
  confidence_score: number;
  matched_patterns: string[];
  sql_query: string;
  original_query: string;
}

interface ExampleQuery {
  query: string;
  description: string;
  expected_filters: Record<string, string>;
}

// ============================================================================
// Component
// ============================================================================

export const OnPremSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OnPremNLPResponse | null>(null);
  const [examples, setExamples] = useState<ExampleQuery[]>([]);
  const [showExamples, setShowExamples] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch examples on mount
  React.useEffect(() => {
    fetchExamples();
  }, []);

  const fetchExamples = async () => {
    try {
      const response = await fetch('/api/onprem-nlp/examples');
      if (response.ok) {
        const data = await response.json();
        setExamples(data);
      }
    } catch (err) {
      console.error('Failed to fetch examples:', err);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('검색어를 입력해주세요');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/onprem-nlp/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'NLP 파싱 실패');
      }

      const data: OnPremNLPResponse = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (exampleQuery: string) => {
    setQuery(exampleQuery);
    setShowExamples(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const getConfidenceColor = (score: number): string => {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  };

  return (
    <div className="onprem-search">
      {/* Header */}
      <div className="onprem-search-header">
        <h2>🔍 자연어 검색</h2>
        <p className="subtitle">
          일상 언어로 품목을 검색하세요 (온프레미스 규칙 기반)
        </p>
      </div>

      {/* Search Input */}
      <div className="search-input-container">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder='예: "스테인리스 파이프 내경 50mm 라우팅 만들어줘"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
          <button
            className="search-button"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
          >
            {loading ? '분석 중...' : '검색'}
          </button>
        </div>

        <button
          className="examples-toggle"
          onClick={() => setShowExamples(!showExamples)}
        >
          {showExamples ? '예시 숨기기' : '예시 보기'} ({examples.length}개)
        </button>
      </div>

      {/* Examples Panel */}
      {showExamples && examples.length > 0 && (
        <div className="examples-panel">
          <h3>예시 쿼리</h3>
          <div className="examples-grid">
            {examples.map((example, idx) => (
              <div
                key={idx}
                className="example-card"
                onClick={() => handleExampleClick(example.query)}
              >
                <div className="example-query">"{example.query}"</div>
                <div className="example-description">{example.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <strong>⚠️ 오류:</strong> {error}
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="results-container">
          {/* Confidence Score */}
          <div className={`confidence-badge ${getConfidenceColor(result.confidence_score)}`}>
            <span className="confidence-label">신뢰도:</span>
            <span className="confidence-value">
              {(result.confidence_score * 100).toFixed(0)}%
            </span>
          </div>

          {/* Extracted Filters */}
          <div className="filters-section">
            <h3>추출된 필터</h3>
            {Object.keys(result.filters).length === 0 ? (
              <p className="no-filters">필터를 추출하지 못했습니다</p>
            ) : (
              <div className="filters-grid">
                {result.filters.material_code && (
                  <div className="filter-item">
                    <span className="filter-label">재질:</span>
                    <span className="filter-value">{result.filters.material_code}</span>
                  </div>
                )}
                {result.filters.part_type && (
                  <div className="filter-item">
                    <span className="filter-label">품목 유형:</span>
                    <span className="filter-value">{result.filters.part_type}</span>
                  </div>
                )}
                {result.filters.inner_diameter_min !== undefined && (
                  <div className="filter-item">
                    <span className="filter-label">내경:</span>
                    <span className="filter-value">
                      {result.filters.inner_diameter_min === result.filters.inner_diameter_max
                        ? `${result.filters.inner_diameter_min}mm`
                        : result.filters.inner_diameter_max === undefined
                        ? `≥${result.filters.inner_diameter_min}mm`
                        : `${result.filters.inner_diameter_min}-${result.filters.inner_diameter_max}mm`}
                    </span>
                  </div>
                )}
                {result.filters.outer_diameter_min !== undefined && (
                  <div className="filter-item">
                    <span className="filter-label">외경:</span>
                    <span className="filter-value">
                      {result.filters.outer_diameter_min === result.filters.outer_diameter_max
                        ? `${result.filters.outer_diameter_min}mm`
                        : result.filters.outer_diameter_max === undefined
                        ? `≥${result.filters.outer_diameter_min}mm`
                        : `${result.filters.outer_diameter_min}-${result.filters.outer_diameter_max}mm`}
                    </span>
                  </div>
                )}
                {result.filters.thickness_min !== undefined && (
                  <div className="filter-item">
                    <span className="filter-label">두께:</span>
                    <span className="filter-value">
                      {result.filters.thickness_min === result.filters.thickness_max
                        ? `${result.filters.thickness_min}mm`
                        : result.filters.thickness_max === undefined
                        ? `≥${result.filters.thickness_min}mm`
                        : `${result.filters.thickness_min}-${result.filters.thickness_max}mm`}
                    </span>
                  </div>
                )}
                {result.filters.drawing_number && (
                  <div className="filter-item">
                    <span className="filter-label">도면번호:</span>
                    <span className="filter-value">{result.filters.drawing_number}</span>
                  </div>
                )}
                {result.filters.is_standard !== undefined && (
                  <div className="filter-item">
                    <span className="filter-label">표준품:</span>
                    <span className="filter-value">
                      {result.filters.is_standard ? '예' : '아니오'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Matched Patterns */}
          {result.matched_patterns.length > 0 && (
            <div className="patterns-section">
              <h3>매칭된 패턴</h3>
              <div className="patterns-list">
                {result.matched_patterns.map((pattern, idx) => (
                  <span key={idx} className="pattern-tag">
                    {pattern}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* SQL Query Preview */}
          <details className="sql-section">
            <summary>생성된 SQL 쿼리 보기</summary>
            <pre className="sql-code">{result.sql_query}</pre>
          </details>
        </div>
      )}

      {/* Info Footer */}
      <div className="info-footer">
        <p>
          ℹ️ 이 검색은 온프레미스 규칙 기반 NLP를 사용합니다 (외부 API 의존성 없음).
          예상 정확도: 70-75%
        </p>
      </div>
    </div>
  );
};

export default OnPremSearch;

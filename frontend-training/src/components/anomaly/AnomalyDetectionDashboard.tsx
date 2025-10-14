import axios from 'axios';
import React, { useEffect, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface AnomalyScore {
  item_id: number;
  item_code: string;
  anomaly_score: number;
  is_anomaly: boolean;
  confidence: number;
  detected_at: string;
  features: Record<string, number>;
  reason: string;
}

interface AnomalyDetectionResult {
  total_items: number;
  anomaly_count: number;
  anomaly_rate: number;
  anomalies: AnomalyScore[];
  model_info: {
    contamination: number;
    n_estimators: number;
    features: string[];
  };
  threshold: number;
  detected_at: string;
}

interface AnomalyStats {
  total_items: number;
  anomaly_count: number;
  anomaly_rate: number;
  threshold: number;
  detected_at: string;
  model_info: {
    contamination: number;
    n_estimators: number;
    features: string[];
  };
  top_10_anomalies: Array<{
    item_code: string;
    anomaly_score: number;
    reason: string;
  }>;
}

// ============================================================================
// Component
// ============================================================================

export const AnomalyDetectionDashboard: React.FC = () => {
  const [stats, setStats] = useState<AnomalyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [training, setTraining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contamination, setContamination] = useState(0.1);
  const [threshold, setThreshold] = useState(-0.5);

  const API_BASE = 'http://localhost:8000';

  // 통계 조회
  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<AnomalyStats>(`${API_BASE}/api/anomaly/stats`);
      setStats(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || '통계 조회 중 오류가 발생했습니다');
      console.error('통계 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // 모델 학습
  const trainModel = async () => {
    setTraining(true);
    setError(null);
    try {
      const response = await axios.post(
        `${API_BASE}/api/anomaly/train`,
        null,
        {
          params: {
            contamination,
            n_estimators: 100,
          },
        }
      );
      alert(`모델 학습 완료!\n\n학습 샘플: ${response.data.n_samples}개\n평균 점수: ${response.data.score_stats.mean.toFixed(3)}`);
      fetchStats();
    } catch (err: any) {
      setError(err.response?.data?.detail || '모델 학습 중 오류가 발생했습니다');
      console.error('모델 학습 실패:', err);
    } finally {
      setTraining(false);
    }
  };

  // 초기 로드
  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="anomaly-detection-dashboard">
      <div className="dashboard-header">
        <h1>🔍 이상 탐지 대시보드</h1>
        <p className="subtitle">Isolation Forest 기반 품목 데이터 이상치 탐지</p>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">총 품목 수</div>
          <div className="stat-value">{stats?.total_items.toLocaleString() || '-'}</div>
        </div>

        <div className="stat-card anomaly">
          <div className="stat-label">이상치 수</div>
          <div className="stat-value">{stats?.anomaly_count.toLocaleString() || '-'}</div>
        </div>

        <div className="stat-card rate">
          <div className="stat-label">이상치 비율</div>
          <div className="stat-value">
            {stats ? (stats.anomaly_rate * 100).toFixed(1) : '-'}%
          </div>
        </div>

        <div className="stat-card threshold">
          <div className="stat-label">임계값</div>
          <div className="stat-value">{stats?.threshold.toFixed(2) || '-'}</div>
        </div>
      </div>

      {/* 제어 패널 */}
      <div className="control-panel">
        <div className="control-section">
          <h3>⚙️ 모델 설정</h3>
          <div className="control-row">
            <label>
              예상 이상치 비율 (Contamination):
              <input
                type="range"
                min="0.01"
                max="0.5"
                step="0.01"
                value={contamination}
                onChange={(e) => setContamination(parseFloat(e.target.value))}
                disabled={training}
              />
              <span className="range-value">{(contamination * 100).toFixed(0)}%</span>
            </label>
          </div>

          <div className="control-row">
            <label>
              이상치 점수 임계값 (Threshold):
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                disabled={training}
              />
              <span className="range-value">{threshold.toFixed(1)}</span>
            </label>
          </div>

          <div className="button-row">
            <button
              className="btn btn-primary"
              onClick={trainModel}
              disabled={training}
            >
              {training ? '학습 중...' : '🎓 모델 학습'}
            </button>

            <button
              className="btn btn-secondary"
              onClick={fetchStats}
              disabled={loading}
            >
              {loading ? '조회 중...' : '🔄 통계 갱신'}
            </button>
          </div>
        </div>
      </div>

      {/* 상위 이상치 목록 */}
      {stats && stats.top_10_anomalies.length > 0 && (
        <div className="anomaly-list">
          <h3>🚨 상위 10개 이상치</h3>
          <table className="anomaly-table">
            <thead>
              <tr>
                <th>#</th>
                <th>품목 코드</th>
                <th>이상치 점수</th>
                <th>이유</th>
              </tr>
            </thead>
            <tbody>
              {stats.top_10_anomalies.map((anomaly, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td className="item-code">{anomaly.item_code}</td>
                  <td className="score">
                    <span className={`score-badge ${anomaly.anomaly_score < -0.7 ? 'critical' : anomaly.anomaly_score < -0.5 ? 'high' : 'medium'}`}>
                      {anomaly.anomaly_score.toFixed(3)}
                    </span>
                  </td>
                  <td className="reason">{anomaly.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 모델 정보 */}
      {stats && (
        <div className="model-info">
          <h3>📊 모델 정보</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Contamination:</span>
              <span className="info-value">{stats.model_info.contamination}</span>
            </div>
            <div className="info-item">
              <span className="info-label">N Estimators:</span>
              <span className="info-value">{stats.model_info.n_estimators}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Features:</span>
              <span className="info-value">{stats.model_info.features.join(', ')}</span>
            </div>
            <div className="info-item">
              <span className="info-label">탐지 시간:</span>
              <span className="info-value">
                {new Date(stats.detected_at).toLocaleString('ko-KR')}
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .anomaly-detection-dashboard {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          min-height: 100vh;
          color: #f1f5f9;
        }

        .dashboard-header {
          margin-bottom: 2rem;
          text-align: center;
        }

        .dashboard-header h1 {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
          color: #7dd3fc;
          text-shadow: 0 0 20px rgba(125, 211, 252, 0.5);
        }

        .subtitle {
          color: #cbd5e1;
          font-size: 1.1rem;
        }

        .error-banner {
          background: rgba(239, 68, 68, 0.2);
          border: 2px solid #ef4444;
          padding: 1rem;
          border-radius: 0.5rem;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .error-icon {
          font-size: 1.5rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: rgba(30, 41, 59, 0.8);
          border: 2px solid rgba(125, 211, 252, 0.3);
          border-radius: 1rem;
          padding: 1.5rem;
          text-align: center;
          transition: all 0.3s ease;
        }

        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 0 30px rgba(125, 211, 252, 0.3);
        }

        .stat-card.anomaly {
          border-color: rgba(239, 68, 68, 0.5);
        }

        .stat-card.anomaly:hover {
          box-shadow: 0 0 30px rgba(239, 68, 68, 0.3);
        }

        .stat-label {
          font-size: 0.9rem;
          color: #94a3b8;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: bold;
          color: #7dd3fc;
        }

        .stat-card.anomaly .stat-value {
          color: #f87171;
        }

        .control-panel {
          background: rgba(30, 41, 59, 0.6);
          border: 2px solid rgba(196, 181, 253, 0.3);
          border-radius: 1rem;
          padding: 2rem;
          margin-bottom: 2rem;
        }

        .control-section h3 {
          color: #c4b5fd;
          margin-bottom: 1.5rem;
          font-size: 1.3rem;
        }

        .control-row {
          margin-bottom: 1.5rem;
        }

        .control-row label {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          color: #cbd5e1;
        }

        .control-row input[type="range"] {
          width: 100%;
          height: 8px;
          border-radius: 5px;
          background: rgba(125, 211, 252, 0.2);
          outline: none;
        }

        .control-row input[type="range"]::-webkit-slider-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #7dd3fc;
          cursor: pointer;
        }

        .range-value {
          font-weight: bold;
          color: #7dd3fc;
          font-size: 1.1rem;
        }

        .button-row {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .btn {
          padding: 0.75rem 2rem;
          border: none;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          flex: 1;
        }

        .btn-primary {
          background: linear-gradient(135deg, #7dd3fc 0%, #3b82f6 100%);
          color: #0f172a;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(125, 211, 252, 0.4);
        }

        .btn-secondary {
          background: linear-gradient(135deg, #c4b5fd 0%, #a855f7 100%);
          color: #0f172a;
        }

        .btn-secondary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(196, 181, 253, 0.4);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .anomaly-list {
          background: rgba(30, 41, 59, 0.6);
          border: 2px solid rgba(239, 68, 68, 0.3);
          border-radius: 1rem;
          padding: 2rem;
          margin-bottom: 2rem;
        }

        .anomaly-list h3 {
          color: #f87171;
          margin-bottom: 1.5rem;
          font-size: 1.3rem;
        }

        .anomaly-table {
          width: 100%;
          border-collapse: collapse;
        }

        .anomaly-table th {
          background: rgba(239, 68, 68, 0.2);
          color: #f1f5f9;
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid rgba(239, 68, 68, 0.5);
        }

        .anomaly-table td {
          padding: 1rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        }

        .anomaly-table tr:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .item-code {
          font-family: 'Courier New', monospace;
          color: #7dd3fc;
          font-weight: 600;
        }

        .score-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 0.5rem;
          font-weight: bold;
        }

        .score-badge.critical {
          background: rgba(239, 68, 68, 0.3);
          border: 1px solid #ef4444;
          color: #fca5a5;
        }

        .score-badge.high {
          background: rgba(251, 146, 60, 0.3);
          border: 1px solid #fb923c;
          color: #fdba74;
        }

        .score-badge.medium {
          background: rgba(234, 179, 8, 0.3);
          border: 1px solid #eab308;
          color: #fde047;
        }

        .reason {
          color: #cbd5e1;
        }

        .model-info {
          background: rgba(30, 41, 59, 0.6);
          border: 2px solid rgba(125, 211, 252, 0.3);
          border-radius: 1rem;
          padding: 2rem;
        }

        .model-info h3 {
          color: #7dd3fc;
          margin-bottom: 1.5rem;
          font-size: 1.3rem;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem;
          background: rgba(15, 23, 42, 0.5);
          border-radius: 0.5rem;
        }

        .info-label {
          color: #94a3b8;
          font-weight: 600;
        }

        .info-value {
          color: #7dd3fc;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default AnomalyDetectionDashboard;

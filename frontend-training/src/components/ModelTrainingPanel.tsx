import React, { useEffect, useState } from "react";
import axios from "axios";

interface TrainingStatus {
  job_id: string | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  progress: number;
  message: string | null;
  version_path: string | null;
  metrics: Record<string, any>;
  latest_version: Record<string, any> | null;
}

export const ModelTrainingPanel: React.FC = () => {
  const [versionLabel, setVersionLabel] = useState('');
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await axios.get('/api/trainer/status');
      setStatus(response.data);
    } catch (err: any) {
      console.error('상태 조회 실패:', err);
    }
  };

  const startTraining = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/trainer/run', {
        version_label: versionLabel || null,
        projector_metadata: [],
        dry_run: dryRun,
      });

      setStatus(response.data);

      // Poll for status updates
      const interval = setInterval(async () => {
        await fetchStatus();
      }, 3000);

      // Stop polling after 5 minutes
      setTimeout(() => clearInterval(interval), 300000);
    } catch (err: any) {
      setError(err.response?.data?.detail || '학습 시작 실패');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white';
      case 'running':
        return 'bg-blue-500 text-white';
      case 'failed':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            🤖 모델 학습
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            새로운 라우팅 모델을 학습하고 배포합니다
          </p>
        </div>

        <hr className="my-4 border-gray-200 dark:border-gray-700" />

        {/* Training Controls */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              모델 버전 이름 (선택사항)
            </label>
            <input
              type="text"
              placeholder="v2.0.0 또는 비워두면 자동 생성"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="dry-run"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="dry-run" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              테스트 모드 (Dry Run)
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={startTraining}
              disabled={loading || status?.status === 'running'}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700
                disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? '시작 중...' : '▶ 학습 시작'}
            </button>

            <button
              onClick={fetchStatus}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              🔄 상태 갱신
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Training Status */}
        {status && (
          <div className="mt-6 space-y-4">
            <hr className="my-4 border-gray-200 dark:border-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">학습 상태</h3>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(status.status)}`}>
                  {status.status}
                </span>
                {status.job_id && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Job ID: {status.job_id}
                  </span>
                )}
              </div>

              {status.progress > 0 && (
                <div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>진행률</span>
                    <span>{status.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${status.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {status.message && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-sm text-blue-800 dark:text-blue-300">{status.message}</p>
                </div>
              )}

              {status.started_at && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  시작: {new Date(status.started_at).toLocaleString('ko-KR')}
                </p>
              )}

              {status.finished_at && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  완료: {new Date(status.finished_at).toLocaleString('ko-KR')}
                </p>
              )}

              {status.version_path && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <p className="text-sm text-green-800 dark:text-green-300">
                    ✅ 모델 저장 위치: {status.version_path}
                  </p>
                </div>
              )}

              {Object.keys(status.metrics).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    학습 메트릭:
                  </p>
                  <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(status.metrics, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Usage Instructions */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>💡 사용 방법:</strong>
            <br />
            1. 모델 버전 이름을 입력하거나 비워두면 타임스탬프로 자동 생성됩니다
            <br />
            2. 테스트 모드를 활성화하면 실제 학습 없이 검증만 수행합니다
            <br />
            3. '학습 시작' 버튼을 클릭하여 새 모델을 학습합니다
            <br />
            4. 학습이 완료되면 자동으로 활성화되어 예측 API에서 사용됩니다
          </p>
        </div>
      </div>
    </div>
  );
};

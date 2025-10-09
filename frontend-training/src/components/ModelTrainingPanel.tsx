import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  LinearProgress,
  Alert,
  Chip,
  Stack,
  Divider,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import axios from 'axios';

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'primary';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <SuccessIcon />;
      case 'running':
        return <ScheduleIcon />;
      case 'failed':
        return <ErrorIcon />;
      default:
        return null;
    }
  };

  React.useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <Card sx={{ maxWidth: 800, mx: 'auto', my: 3 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          🤖 모델 학습
        </Typography>
        <Divider sx={{ my: 2 }} />

        {/* Training Controls */}
        <Stack spacing={2}>
          <TextField
            label="모델 버전 이름 (선택사항)"
            placeholder="v2.0.0 또는 비워두면 자동 생성"
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value)}
            fullWidth
            size="small"
          />

          <FormControlLabel
            control={
              <Switch
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
            }
            label="테스트 모드 (Dry Run)"
          />

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayIcon />}
              onClick={startTraining}
              disabled={loading || status?.status === 'running'}
              fullWidth
            >
              {loading ? '시작 중...' : '학습 시작'}
            </Button>

            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchStatus}
              disabled={loading}
            >
              상태 갱신
            </Button>
          </Stack>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Stack>

        {/* Training Status */}
        {status && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              학습 상태
            </Typography>

            <Stack spacing={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={status.status}
                  color={getStatusColor(status.status) as any}
                  icon={getStatusIcon(status.status)}
                  size="small"
                />
                {status.job_id && (
                  <Typography variant="caption" color="text.secondary">
                    Job ID: {status.job_id}
                  </Typography>
                )}
              </Box>

              {status.progress > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    진행률: {status.progress}%
                  </Typography>
                  <LinearProgress variant="determinate" value={status.progress} />
                </Box>
              )}

              {status.message && (
                <Alert severity="info">{status.message}</Alert>
              )}

              {status.started_at && (
                <Typography variant="body2" color="text.secondary">
                  시작: {new Date(status.started_at).toLocaleString('ko-KR')}
                </Typography>
              )}

              {status.finished_at && (
                <Typography variant="body2" color="text.secondary">
                  완료: {new Date(status.finished_at).toLocaleString('ko-KR')}
                </Typography>
              )}

              {status.version_path && (
                <Alert severity="success">
                  모델 저장 위치: {status.version_path}
                </Alert>
              )}

              {Object.keys(status.metrics).length > 0 && (
                <Box>
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    학습 메트릭:
                  </Typography>
                  <Box
                    sx={{
                      bgcolor: 'background.paper',
                      p: 1,
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                    }}
                  >
                    <pre>{JSON.stringify(status.metrics, null, 2)}</pre>
                  </Box>
                </Box>
              )}
            </Stack>
          </Box>
        )}

        {/* Usage Instructions */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            💡 <strong>사용 방법:</strong>
            <br />
            1. 모델 버전 이름을 입력하거나 비워두면 타임스탬프로 자동 생성됩니다
            <br />
            2. 테스트 모드를 활성화하면 실제 학습 없이 검증만 수행합니다
            <br />
            3. '학습 시작' 버튼을 클릭하여 새 모델을 학습합니다
            <br />
            4. 학습이 완료되면 자동으로 활성화되어 예측 API에서 사용됩니다
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

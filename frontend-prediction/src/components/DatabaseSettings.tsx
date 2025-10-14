import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface DatabaseConfig {
  server: string;
  database: string;
  user: string;
  encrypt: boolean;
  trust_certificate: boolean;
}

interface DatabaseInfo {
  connection_status: string;
  server: string;
  database: string;
  database_size_mb?: number;
  tables_info?: Record<string, any>;
}

interface ConnectionTestPayload extends DatabaseConfig {
  password: string;
}

export function DatabaseSettings() {
  const [config, setConfig] = useState<DatabaseConfig>({
    server: '',
    database: '',
    user: '',
    encrypt: false,
    trust_certificate: true,
  });

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);

  useEffect(() => {
    loadCurrentConfig();
    loadDatabaseInfo();
  }, []);

  const loadCurrentConfig = async () => {
    try {
      const response = await fetch('/api/database/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to load database config:', error);
    }
  };

  const loadDatabaseInfo = async () => {
    try {
      const response = await fetch('/api/database/info');
      if (response.ok) {
        const data = await response.json();
        setDbInfo(data);
      }
    } catch (error) {
      console.error('Failed to load database info:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!password) {
      alert('비밀번호를 입력해주세요');
      return false;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const payload: ConnectionTestPayload = {
        ...config,
        password,
      };

      const response = await fetch('/api/database/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({
          success: data.success,
          message: data.message,
          details: data.details,
        });
        return data.success;
      } else {
        setTestResult({
          success: false,
          message: data.detail || '연결 테스트 실패',
        });
        return false;
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `연결 테스트 중 오류 발생: ${error}`,
      });
      return false;
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!password) {
      alert('비밀번호를 입력해주세요');
      return;
    }

    // 먼저 연결 테스트 실행
    setTesting(true);
    const testSuccess = await handleTestConnection();
    setTesting(false);

    // 테스트 실패 시 확인
    if (!testSuccess) {
      if (!confirm('연결 테스트가 실패했습니다. 그래도 저장하시겠습니까?')) {
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch('/api/database/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || '설정이 저장되었습니다. 애플리케이션을 재시작해주세요.');
        loadDatabaseInfo();
      } else {
        const error = await response.json();
        alert(`저장 실패: ${error.detail}`);
      }
    } catch (error) {
      alert(`저장 중 오류 발생: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Database size={28} color="#3b82f6" />
          <h2 style={{ fontSize: '24px', fontWeight: '600', margin: 0, color: '#f1f5f9' }}>
            데이터베이스 설정
          </h2>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
          MSSQL 데이터베이스 연결 정보를 설정합니다.
        </p>
      </div>

      {/* 현재 연결 상태 */}
      {dbInfo && (
        <div
          style={{
            backgroundColor: dbInfo.connection_status === '정상' ? '#10b981' : '#ef4444',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {dbInfo.connection_status === '정상' ? (
            <CheckCircle size={20} color="#ffffff" />
          ) : (
            <XCircle size={20} color="#ffffff" />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ color: '#ffffff', fontWeight: '500' }}>
              {dbInfo.connection_status === '정상' ? '연결됨' : '연결 끊김'}
            </div>
            <div style={{ color: '#ffffff', fontSize: '12px', marginTop: '4px' }}>
              {dbInfo.server} / {dbInfo.database}
              {dbInfo.database_size_mb && ` (${dbInfo.database_size_mb.toFixed(2)} MB)`}
            </div>
          </div>
          <button
            onClick={loadDatabaseInfo}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RefreshCw size={14} />
            새로고침
          </button>
        </div>
      )}

      {/* 설정 폼 */}
      <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '14px', marginBottom: '6px' }}>
              서버 주소 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={config.server}
              onChange={(e) => setConfig({ ...config, server: e.target.value })}
              placeholder="예: server.com,1433"
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#f1f5f9',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '14px', marginBottom: '6px' }}>
              데이터베이스명 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={config.database}
              onChange={(e) => setConfig({ ...config, database: e.target.value })}
              placeholder="데이터베이스명"
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#f1f5f9',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '14px', marginBottom: '6px' }}>
              사용자명 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={config.user}
              onChange={(e) => setConfig({ ...config, user: e.target.value })}
              placeholder="사용자명"
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#f1f5f9',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '14px', marginBottom: '6px' }}>
              비밀번호 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 (테스트 및 저장 시 필요)"
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#f1f5f9',
                fontSize: '14px',
              }}
            />
            <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>
              주의: 비밀번호는 .env 파일에 저장되지 않습니다. 환경 변수 MSSQL_PASSWORD로 별도 설정하세요.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1' }}>
              <input
                type="checkbox"
                checked={config.encrypt}
                onChange={(e) => setConfig({ ...config, encrypt: e.target.checked })}
                style={{ width: '16px', height: '16px' }}
              />
              암호화 사용 (Encrypt)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1' }}>
              <input
                type="checkbox"
                checked={config.trust_certificate}
                onChange={(e) => setConfig({ ...config, trust_certificate: e.target.checked })}
                style={{ width: '16px', height: '16px' }}
              />
              인증서 신뢰 (TrustServerCertificate)
            </label>
          </div>
        </div>
      </div>

      {/* 테스트 결과 */}
      {testResult && (
        <div
          style={{
            backgroundColor: testResult.success ? '#064e3b' : '#7f1d1d',
            border: `1px solid ${testResult.success ? '#10b981' : '#ef4444'}`,
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'start',
            gap: '12px',
          }}
        >
          {testResult.success ? (
            <CheckCircle size={20} color="#10b981" />
          ) : (
            <AlertCircle size={20} color="#ef4444" />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ color: '#f1f5f9', fontWeight: '500', marginBottom: '4px' }}>
              {testResult.message}
            </div>
            {testResult.details && (
              <div style={{ color: '#cbd5e1', fontSize: '12px' }}>
                <div>서버: {testResult.details.server}</div>
                <div>데이터베이스: {testResult.details.database}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={handleTestConnection}
          disabled={testing || !config.server || !config.database || !config.user || !password}
          style={{
            flex: 1,
            padding: '12px 24px',
            backgroundColor: testing ? '#475569' : '#3b82f6',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: '500',
            cursor: testing ? 'not-allowed' : 'pointer',
            opacity: testing || !config.server || !config.database || !config.user || !password ? 0.6 : 1,
          }}
        >
          {testing ? '테스트 중...' : '연결 테스트'}
        </button>

        <button
          onClick={handleSaveConfig}
          disabled={loading || !config.server || !config.database || !config.user}
          style={{
            flex: 1,
            padding: '12px 24px',
            backgroundColor: loading ? '#475569' : '#10b981',
            border: 'none',
            borderRadius: '6px',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading || !config.server || !config.database || !config.user ? 0.6 : 1,
          }}
        >
          {loading ? '저장 중...' : '설정 저장'}
        </button>
      </div>
    </div>
  );
}

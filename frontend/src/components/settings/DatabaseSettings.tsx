import { useState, useEffect } from 'react';

interface DatabaseConfig {
  db_type: string;
  server: string | null;
  database: string | null;
  user: string | null;
  encrypt: boolean;
  trust_certificate: boolean;
}

interface DatabaseInfo {
  db_type: string;
  connection_status: string;
  database_path?: string;
  database_size_mb?: number;
  tables_info?: Record<string, number | string>;
}

interface DatabaseSettingsProps {
  apiBaseUrl?: string;
}

export function DatabaseSettings({ apiBaseUrl = '/api' }: DatabaseSettingsProps) {
  const [config, setConfig] = useState<DatabaseConfig>({
    db_type: 'ACCESS',
    server: null,
    database: null,
    user: null,
    encrypt: false,
    trust_certificate: true,
  });

  const [password, setPassword] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [info, setInfo] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadDatabaseConfig();
    loadDatabaseInfo();
  }, []);

  const loadDatabaseConfig = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/database/config`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load database config');
      }

      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Failed to load database config:', error);
      setMessage({ type: 'error', text: '데이터베이스 설정을 불러오지 못했습니다.' });
    }
  };

  const loadDatabaseInfo = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/database/info`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load database info');
      }

      const data = await response.json();
      setInfo(data);
    } catch (error) {
      console.error('Failed to load database info:', error);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setMessage(null);

    try {
      const testConfig = {
        db_type: config.db_type,
        server: config.server,
        database: config.database,
        user: config.user,
        password: testPassword,
      };

      const response = await fetch(`${apiBaseUrl}/database/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(testConfig),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || '연결 성공!' });
      } else {
        setMessage({ type: 'error', text: data.detail || '연결 실패' });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setMessage({ type: 'error', text: '연결 테스트 중 오류가 발생했습니다.' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/database/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || '설정이 저장되었습니다.' });

        // 비밀번호가 입력된 경우 별도로 저장
        if (password) {
          await handleSavePassword();
        }
      } else {
        setMessage({ type: 'error', text: data.detail || '설정 저장 실패' });
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      setMessage({ type: 'error', text: '설정 저장 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassword = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/database/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(password),
      });

      if (!response.ok) {
        throw new Error('Failed to save password');
      }
    } catch (error) {
      console.error('Failed to save password:', error);
    }
  };

  return (
    <div className="database-settings">
      <div className="panel-card">
        <div className="panel-header">
          <h2 className="panel-title">데이터베이스 설정</h2>
          <p className="panel-subtitle">데이터베이스 연결 설정을 관리합니다</p>
        </div>

        <div className="database-settings__content">
          {/* 현재 상태 */}
          {info && (
            <section className="settings-section">
              <h3 className="settings-section__title">현재 연결 상태</h3>
              <div className="status-grid">
                <div className="status-item">
                  <span className="status-label">데이터베이스 타입</span>
                  <span className={`status-badge status-badge--${info.db_type.toLowerCase()}`}>
                    {info.db_type}
                  </span>
                </div>
                <div className="status-item">
                  <span className="status-label">연결 상태</span>
                  <span
                    className={`status-badge ${
                      info.connection_status === '정상'
                        ? 'status-badge--success'
                        : 'status-badge--error'
                    }`}
                  >
                    {info.connection_status}
                  </span>
                </div>
                {info.database_path && (
                  <div className="status-item status-item--wide">
                    <span className="status-label">데이터베이스 경로</span>
                    <span className="status-value">{info.database_path}</span>
                  </div>
                )}
                {info.database_size_mb && (
                  <div className="status-item">
                    <span className="status-label">파일 크기</span>
                    <span className="status-value">{info.database_size_mb} MB</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* DB 타입 선택 */}
          <section className="settings-section">
            <h3 className="settings-section__title">데이터베이스 타입</h3>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="db_type"
                  value="ACCESS"
                  checked={config.db_type === 'ACCESS'}
                  onChange={(e) => setConfig({ ...config, db_type: e.target.value })}
                />
                <span>Access Database</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="db_type"
                  value="MSSQL"
                  checked={config.db_type === 'MSSQL'}
                  onChange={(e) => setConfig({ ...config, db_type: e.target.value })}
                />
                <span>Microsoft SQL Server</span>
              </label>
            </div>
          </section>

          {/* MSSQL 설정 */}
          {config.db_type === 'MSSQL' && (
            <section className="settings-section">
              <h3 className="settings-section__title">MSSQL 서버 연결 정보</h3>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="server" className="form-label">
                    서버 주소
                  </label>
                  <input
                    id="server"
                    type="text"
                    value={config.server || ''}
                    onChange={(e) => setConfig({ ...config, server: e.target.value })}
                    placeholder="예: K3-DB.ksm.co.kr,1433"
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="database" className="form-label">
                    데이터베이스 이름
                  </label>
                  <input
                    id="database"
                    type="text"
                    value={config.database || ''}
                    onChange={(e) => setConfig({ ...config, database: e.target.value })}
                    placeholder="예: KsmErp"
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="user" className="form-label">
                    사용자 ID
                  </label>
                  <input
                    id="user"
                    type="text"
                    value={config.user || ''}
                    onChange={(e) => setConfig({ ...config, user: e.target.value })}
                    placeholder="예: FKSM_BI"
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="password" className="form-label">
                    비밀번호
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 입력"
                    className="form-input"
                  />
                  <p className="form-hint">
                    보안상 비밀번호는 세션에만 저장됩니다 (재시작 시 재입력 필요)
                  </p>
                </div>

                <div className="form-field form-field--checkbox">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.trust_certificate}
                      onChange={(e) => setConfig({ ...config, trust_certificate: e.target.checked })}
                    />
                    <span>서버 인증서 신뢰</span>
                  </label>
                </div>
              </div>
            </section>
          )}

          {/* 연결 테스트 */}
          {config.db_type === 'MSSQL' && (
            <section className="settings-section">
              <h3 className="settings-section__title">연결 테스트</h3>
              <div className="test-connection">
                <input
                  type="password"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  placeholder="테스트용 비밀번호 입력"
                  className="form-input"
                />
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection || !testPassword}
                  className="btn-secondary"
                >
                  {testingConnection ? '테스트 중...' : '연결 테스트'}
                </button>
              </div>
            </section>
          )}

          {/* 메시지 */}
          {message && (
            <div className={`message message--${message.type}`}>
              {message.text}
            </div>
          )}

          {/* 저장 버튼 */}
          <div className="settings-actions">
            <button onClick={handleSaveConfig} disabled={loading} className="btn-primary">
              {loading ? '저장 중...' : '설정 저장'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .database-settings__content {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .settings-section {
          border-bottom: 1px solid var(--border-light);
          padding-bottom: 1.5rem;
        }

        .settings-section:last-of-type {
          border-bottom: none;
        }

        .settings-section__title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 1rem 0;
        }

        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .status-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .status-item--wide {
          grid-column: 1 / -1;
        }

        .status-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .status-value {
          font-size: 0.875rem;
          color: var(--text-primary);
          font-family: monospace;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .status-badge--access {
          background: var(--info-bg);
          color: var(--info-text);
        }

        .status-badge--mssql {
          background: var(--accent-bg);
          color: var(--accent-text);
        }

        .status-badge--success {
          background: var(--success-bg);
          color: var(--success-text);
        }

        .status-badge--error {
          background: var(--error-bg);
          color: var(--error-text);
        }

        .radio-group {
          display: flex;
          gap: 1.5rem;
        }

        .radio-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .radio-label input[type='radio'] {
          width: 1rem;
          height: 1rem;
        }

        .form-grid {
          display: grid;
          gap: 1rem;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-label {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .form-input {
          padding: 0.625rem 0.875rem;
          border: 1px solid var(--border-light);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background: var(--surface-base);
          color: var(--text-primary);
        }

        .form-input:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .form-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin: 0;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .checkbox-label input[type='checkbox'] {
          width: 1rem;
          height: 1rem;
        }

        .test-connection {
          display: flex;
          gap: 0.5rem;
        }

        .message {
          padding: 1rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
        }

        .message--success {
          background: var(--success-bg);
          color: var(--success-text);
          border: 1px solid var(--success-border);
        }

        .message--error {
          background: var(--error-bg);
          color: var(--error-text);
          border: 1px solid var(--error-border);
        }

        .message--info {
          background: var(--info-bg);
          color: var(--info-text);
          border: 1px solid var(--info-border);
        }

        .settings-actions {
          display: flex;
          justify-content: flex-end;
          padding-top: 1rem;
        }
      `}</style>
    </div>
  );
}

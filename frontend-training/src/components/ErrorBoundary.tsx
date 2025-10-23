import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary 컴포넌트
 * 하위 컴포넌트에서 발생한 에러를 catch하여 fallback UI를 표시
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(_: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // 프로덕션 환경에서는 에러 로깅 서비스로 전송
    // 예: Sentry, LogRocket 등
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // 사용자 정의 fallback UI가 제공된 경우
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 fallback UI
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: '600px',
              padding: '2rem',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-card, #1e293b)',
              border: '1px solid var(--border, #334155)',
            }}
          >
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                marginBottom: '1rem',
                color: 'var(--text-heading, #f1f5f9)',
              }}
            >
              ⚠️ 오류가 발생했습니다
            </h2>
            <p
              style={{
                fontSize: '1rem',
                marginBottom: '1.5rem',
                color: 'var(--text-body, #cbd5e1)',
              }}
            >
              애플리케이션에서 예상치 못한 오류가 발생했습니다.
              <br />
              페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
            </p>

            {this.state.error && (
              <details
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: 'var(--surface, #0f172a)',
                  borderRadius: '4px',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                  color: 'var(--text-muted, #94a3b8)',
                }}
              >
                <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                  에러 상세 정보 (개발자용)
                </summary>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  <strong>에러 메시지:</strong> {this.state.error.message}
                  {'\n\n'}
                  <strong>스택 트레이스:</strong>
                  {'\n'}
                  {this.state.error.stack}
                  {this.state.errorInfo && (
                    <>
                      {'\n\n'}
                      <strong>컴포넌트 스택:</strong>
                      {'\n'}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #334155)',
                  backgroundColor: 'var(--surface-card, #1e293b)',
                  color: 'var(--text-heading, #f1f5f9)',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-hover, #2d3748)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-card, #1e293b)';
                }}
              >
                다시 시도
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '6px',
                  border: '1px solid var(--accent, #0ea5e9)',
                  backgroundColor: 'var(--accent, #0ea5e9)',
                  color: '#ffffff',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent-hover, #0284c7)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent, #0ea5e9)';
                }}
              >
                페이지 새로고침
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

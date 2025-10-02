import { useState, useRef } from 'react';

interface PreviewRow {
  routing_code: string;
  item_codes: string[];
  step_count: number;
  has_errors: boolean;
  errors: string[];
}

interface ValidationError {
  row: number;
  column?: string;
  error: string;
  value?: string;
}

interface PreviewResponse {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  preview: PreviewRow[];
  errors: ValidationError[];
  column_mapping: Record<string, string>;
}

interface BulkUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
  apiBaseUrl?: string;
}

export function BulkUploadDialog({
  isOpen,
  onClose,
  onSuccess,
  apiBaseUrl = '/api'
}: BulkUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(null);
      setError(null);
    }
  };

  const handlePreview = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${apiBaseUrl}/bulk-upload/preview`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || '미리보기 생성 실패');
      }

      const data: PreviewResponse = await response.json();
      setPreview(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(errorMsg);
      console.error('미리보기 생성 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${apiBaseUrl}/bulk-upload/execute`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || '업로드 실패');
      }

      const data = await response.json();
      onSuccess?.(data);
      handleClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(errorMsg);
      console.error('업로드 실패:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="bulk-upload-overlay" onClick={handleClose}>
      <div
        className="bulk-upload-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <header className="bulk-upload-header">
          <div>
            <h2 className="bulk-upload-title">📤 라우팅 대량 업로드</h2>
            <p className="bulk-upload-subtitle">
              엑셀(.xlsx, .xls) 또는 CSV 파일로 라우팅을 일괄 생성하세요
            </p>
          </div>
          <button
            onClick={handleClose}
            className="bulk-upload-close"
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        {/* 파일 선택 */}
        <div className="bulk-upload-content">
          <div className="file-upload-zone">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="file-input-hidden"
              id="bulk-upload-file"
            />
            <label htmlFor="bulk-upload-file" className="file-upload-label">
              {file ? (
                <div className="file-selected">
                  <span className="file-icon">📄</span>
                  <div className="file-info">
                    <p className="file-name">{file.name}</p>
                    <p className="file-size">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="file-placeholder">
                  <span className="upload-icon">📁</span>
                  <p>파일을 선택하거나 드래그하여 업로드하세요</p>
                  <p className="file-hint">.xlsx, .xls, .csv 파일만 지원</p>
                </div>
              )}
            </label>

            {file && (
              <button
                onClick={handlePreview}
                disabled={loading}
                className="btn-pastel-blue"
              >
                {loading ? '분석 중...' : '미리보기'}
              </button>
            )}
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          {/* 미리보기 결과 */}
          {preview && (
            <div className="preview-section">
              <div className="preview-summary">
                <div className="summary-card">
                  <span className="summary-label">전체 행</span>
                  <span className="summary-value">{preview.total_rows}</span>
                </div>
                <div className="summary-card success">
                  <span className="summary-label">유효</span>
                  <span className="summary-value">{preview.valid_rows}</span>
                </div>
                <div className="summary-card error">
                  <span className="summary-label">오류</span>
                  <span className="summary-value">{preview.error_rows}</span>
                </div>
              </div>

              {/* 미리보기 데이터 */}
              {preview.preview.length > 0 && (
                <div className="preview-table-wrapper">
                  <h3 className="preview-table-title">라우팅 미리보기 (최대 50개)</h3>
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th>라우팅 코드</th>
                        <th>품목 코드</th>
                        <th>공정 수</th>
                        <th>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview.map((row, index) => (
                        <tr key={index} className={row.has_errors ? 'row-error' : ''}>
                          <td>{row.routing_code}</td>
                          <td>{row.item_codes.join(', ') || '-'}</td>
                          <td>{row.step_count}</td>
                          <td>
                            {row.has_errors ? (
                              <span className="status-badge error">오류</span>
                            ) : (
                              <span className="status-badge success">정상</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 오류 목록 */}
              {preview.errors.length > 0 && (
                <div className="errors-section">
                  <h3 className="errors-title">검증 오류 (최대 100개)</h3>
                  <div className="errors-list">
                    {preview.errors.map((err, index) => (
                      <div key={index} className="error-item">
                        <span className="error-row">행 {err.row}</span>
                        {err.column && (
                          <span className="error-column">{err.column}</span>
                        )}
                        <span className="error-text">{err.error}</span>
                        {err.value && (
                          <span className="error-value">"{err.value}"</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <footer className="bulk-upload-footer">
          <button onClick={handleClose} className="btn-secondary">
            취소
          </button>
          <button
            onClick={handleUpload}
            disabled={!preview || preview.error_rows > 0 || uploading}
            className="btn-pastel-green"
          >
            {uploading ? '업로드 중...' : `업로드 (${preview?.valid_rows || 0}개)`}
          </button>
        </footer>
      </div>

      <style jsx>{`
        .bulk-upload-overlay {
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

        .bulk-upload-dialog {
          background: var(--surface-base);
          border-radius: 1rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .bulk-upload-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1.5rem;
          border-bottom: 1px solid var(--border-light);
        }

        .bulk-upload-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 0.25rem 0;
        }

        .bulk-upload-subtitle {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin: 0;
        }

        .bulk-upload-close {
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

        .bulk-upload-close:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .bulk-upload-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .file-upload-zone {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .file-input-hidden {
          display: none;
        }

        .file-upload-label {
          border: 2px dashed var(--border-light);
          border-radius: 0.75rem;
          padding: 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--surface-overlay);
        }

        .file-upload-label:hover {
          border-color: var(--accent-primary);
          background: var(--surface-hover);
        }

        .file-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .upload-icon {
          font-size: 3rem;
        }

        .file-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin: 0;
        }

        .file-selected {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .file-icon {
          font-size: 2rem;
        }

        .file-info {
          text-align: left;
        }

        .file-name {
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 0.25rem 0;
        }

        .file-size {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin: 0;
        }

        .preview-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .preview-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        .summary-card {
          padding: 1rem;
          border-radius: 0.5rem;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
          border: 1px solid rgba(99, 102, 241, 0.2);
          text-align: center;
        }

        .summary-card.success {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%);
          border-color: rgba(16, 185, 129, 0.2);
        }

        .summary-card.error {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%);
          border-color: rgba(239, 68, 68, 0.2);
        }

        .summary-label {
          display: block;
          font-size: 0.875rem;
          color: var(--text-muted);
          margin-bottom: 0.5rem;
        }

        .summary-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .preview-table-wrapper,
        .errors-section {
          border: 1px solid var(--border-light);
          border-radius: 0.75rem;
          padding: 1rem;
          background: var(--surface-overlay);
        }

        .preview-table-title,
        .errors-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 0.75rem 0;
        }

        .preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .preview-table th {
          text-align: left;
          padding: 0.5rem;
          border-bottom: 1px solid var(--border-light);
          font-weight: 600;
          color: var(--text-muted);
        }

        .preview-table td {
          padding: 0.5rem;
          border-bottom: 1px solid var(--border-lightest);
        }

        .preview-table tr.row-error {
          background: rgba(239, 68, 68, 0.05);
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .status-badge.success {
          background: rgba(16, 185, 129, 0.1);
          color: rgb(5, 150, 105);
        }

        .status-badge.error {
          background: rgba(239, 68, 68, 0.1);
          color: rgb(220, 38, 38);
        }

        .errors-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 300px;
          overflow-y: auto;
        }

        .error-item {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          padding: 0.5rem;
          background: var(--surface-base);
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }

        .error-row {
          font-weight: 600;
          color: var(--error-text);
        }

        .error-column {
          padding: 0.125rem 0.375rem;
          background: rgba(99, 102, 241, 0.1);
          border-radius: 0.25rem;
          font-size: 0.75rem;
          color: var(--accent-primary);
        }

        .error-text {
          flex: 1;
          color: var(--text-primary);
        }

        .error-value {
          font-family: monospace;
          color: var(--text-muted);
          font-size: 0.75rem;
        }

        .bulk-upload-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border-light);
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }
      `}</style>
    </div>
  );
}

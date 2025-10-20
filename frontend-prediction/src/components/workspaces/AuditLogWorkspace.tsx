import { CardShell } from "@components/common/CardShell";
import { ClipboardList, Filter, RefreshCw, Search, X } from "lucide-react";
import { type ChangeEvent, type CSSProperties,useCallback, useEffect, useState } from "react";

interface AuditEvent {
  timestamp: string;
  batch_id: string;
  source: string | null;
  action: string;
  username: string | null;
  ip_address: string | null;
  payload: Record<string, unknown> | null;
}

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.85rem",
};

const headerCellStyle: CSSProperties = {
  textAlign: "left",
  borderBottom: "2px solid var(--border-strong)",
  padding: "0.5rem",
  background: "var(--surface-subtle)",
  fontWeight: 600,
  color: "var(--text-muted)",
};

const cellStyle: CSSProperties = {
  borderBottom: "1px solid var(--border-subtle)",
  padding: "0.5rem",
  verticalAlign: "top",
};

const filterContainerStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  marginBottom: "1rem",
  flexWrap: "wrap",
  alignItems: "center",
};

const inputStyle: CSSProperties = {
  padding: "0.4rem 0.6rem",
  borderRadius: "var(--layout-radius)",
  border: "1px solid var(--border-subtle)",
  background: "var(--surface-card)",
  color: "var(--text-default)",
  fontSize: "0.85rem",
  flex: "1 1 150px",
  maxWidth: "200px",
};

const buttonStyle: CSSProperties = {
  padding: "0.4rem 0.75rem",
  borderRadius: "var(--layout-radius)",
  border: "1px solid var(--border-strong)",
  background: "var(--surface-card)",
  color: "var(--text-default)",
  fontSize: "0.85rem",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  transition: "all 0.2s",
};

const statsStyle: CSSProperties = {
  padding: "0.75rem",
  marginBottom: "1rem",
  background: "var(--surface-subtle)",
  borderRadius: "var(--layout-radius)",
  display: "flex",
  gap: "1.5rem",
  fontSize: "0.85rem",
  color: "var(--text-muted)",
};

const payloadStyle: CSSProperties = {
  fontSize: "0.75rem",
  color: "var(--text-muted)",
  maxWidth: "300px",
  overflow: "auto",
  background: "var(--surface-subtle)",
  padding: "0.3rem",
  borderRadius: "var(--layout-radius)",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

export function AuditLogWorkspace() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionFilter, setActionFilter] = useState("");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [limitFilter, setLimitFilter] = useState("100");

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (limitFilter) params.append("limit", limitFilter);
      if (actionFilter) params.append("action_filter", actionFilter);
      if (usernameFilter) params.append("username_filter", usernameFilter);

      const response = await fetch(`/api/audit/ui/events?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch audit logs: ${response.statusText}`);
      }

      const data: AuditEvent[] = await response.json();
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, usernameFilter, limitFilter]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleClearFilters = () => {
    setActionFilter("");
    setUsernameFilter("");
    setLimitFilter("100");
  };

  const uniqueActions = new Set(events.map((e) => e.action)).size;
  const uniqueUsers = new Set(events.map((e) => e.username).filter(Boolean)).size;

  return (
    <CardShell innerClassName="space-y-3">
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <ClipboardList size={18} style={{ color: "var(--text-muted)" }} />
        <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-default)" }}>감사 로그</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {/* Filter Controls */}
        <div style={filterContainerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: "1 1 200px" }}>
            <Search size={14} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Action 필터"
              value={actionFilter}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setActionFilter(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: "1 1 200px" }}>
            <Filter size={14} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Username 필터"
              value={usernameFilter}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setUsernameFilter(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: "0 1 120px" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Limit:</label>
            <input
              type="number"
              min="10"
              max="1000"
              value={limitFilter}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setLimitFilter(e.target.value)}
              style={{ ...inputStyle, maxWidth: "80px" }}
            />
          </div>

          <button type="button" onClick={fetchAuditLogs} style={buttonStyle} disabled={loading}>
            <RefreshCw size={14} />
            새로고침
          </button>

          <button type="button" onClick={handleClearFilters} style={buttonStyle}>
            <X size={14} />
            초기화
          </button>
        </div>

        {/* Statistics */}
        <div style={statsStyle}>
          <span>
            <strong>전체 이벤트:</strong> {events.length}
          </span>
          <span>
            <strong>고유 액션:</strong> {uniqueActions}
          </span>
          <span>
            <strong>고유 사용자:</strong> {uniqueUsers}
          </span>
        </div>

        {/* Error Display */}
        {error && (
          <div
            style={{
              padding: "0.75rem",
              background: "var(--surface-error)",
              color: "var(--text-error)",
              borderRadius: "var(--layout-radius)",
              fontSize: "0.85rem",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
            로딩 중...
          </div>
        )}

        {/* Audit Log Table */}
        {!loading && events.length > 0 && (
          <div style={{ overflow: "auto", maxHeight: "600px" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headerCellStyle}>시간</th>
                  <th style={headerCellStyle}>액션</th>
                  <th style={headerCellStyle}>사용자</th>
                  <th style={headerCellStyle}>IP 주소</th>
                  <th style={headerCellStyle}>Source</th>
                  <th style={headerCellStyle}>Payload</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => (
                  <tr key={`${event.batch_id}-${index}`}>
                    <td style={cellStyle}>
                      {new Date(event.timestamp).toLocaleString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td style={cellStyle}>
                      <code style={{ fontSize: "0.8rem", color: "var(--text-accent)" }}>
                        {event.action}
                      </code>
                    </td>
                    <td style={cellStyle}>{event.username || "-"}</td>
                    <td style={cellStyle}>{event.ip_address || "-"}</td>
                    <td style={cellStyle}>{event.source || "-"}</td>
                    <td style={cellStyle}>
                      {event.payload ? (
                        <details>
                          <summary style={{ cursor: "pointer", color: "var(--text-accent)" }}>
                            상세보기
                          </summary>
                          <div style={payloadStyle}>
                            {JSON.stringify(event.payload, null, 2)}
                          </div>
                        </details>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!loading && events.length === 0 && !error && (
          <div
            style={{
              textAlign: "center",
              padding: "3rem 1rem",
              color: "var(--text-muted)",
            }}
          >
            <ClipboardList size={48} style={{ opacity: 0.3, marginBottom: "1rem" }} />
            <p>감사 로그가 없습니다.</p>
          </div>
        )}
      </div>
    </CardShell>
  );
}

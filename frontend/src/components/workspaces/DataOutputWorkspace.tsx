import { postUiAudit, saveWorkspaceSettings } from "@lib/apiClient";
import { DownloadCloud, Plus, Save, Upload } from "lucide-react";
import { useMemo, useState } from "react";

const OUTPUT_PROFILES = [
  { id: "default", name: "Default", description: "CSV · UTF-8", updatedAt: "2025-09-20" },
  { id: "erp", name: "ERP", description: "ACCESS · Shift-JIS", updatedAt: "2025-09-21" },
  { id: "xml", name: "MES XML", description: "XML · Namespaced", updatedAt: "2025-09-22" },
];

const SAMPLE_MAPPING = [
  { source: "ITEM_CD", mapped: "item_code", type: "string", required: true },
  { source: "ROUTING_ID", mapped: "routing_id", type: "string", required: true },
  { source: "PROC_SEQ", mapped: "sequence", type: "number", required: true },
  { source: "PROC_CD", mapped: "operation_code", type: "string", required: true },
  { source: "SETUP_TIME", mapped: "setup_min", type: "number", required: false },
  { source: "RUN_TIME", mapped: "run_min", type: "number", required: false },
  { source: "WAIT_TIME", mapped: "wait_min", type: "number", required: false },
];

const SAMPLE_PREVIEW = [
  { item_code: "ITEM-001", routing_id: "ROUT-001", sequence: 1, operation_code: "CUT", setup_min: 12 },
  { item_code: "ITEM-001", routing_id: "ROUT-001", sequence: 2, operation_code: "WELD", setup_min: 6 },
  { item_code: "ITEM-001", routing_id: "ROUT-001", sequence: 3, operation_code: "PAINT", setup_min: 4 },
];

export function DataOutputWorkspace() {
  const [selectedProfile, setSelectedProfile] = useState(OUTPUT_PROFILES[0]);
  const [format, setFormat] = useState("CSV");
  const [statusMessage, setStatusMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const previewColumns = useMemo(() => Object.keys(SAMPLE_PREVIEW[0] ?? {}), []);

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setStatusMessage("");
      await saveWorkspaceSettings({
        version: Date.now(),
        output: {
          profile_id: selectedProfile.id,
          format,
        },
      });
      await postUiAudit({
        action: "ui.output.profile.save",
        username: "codex",
        payload: {
          profile_id: selectedProfile.id,
          format,
        },
      });
      setStatusMessage("Output profile saved.");
    } catch (error) {
      setStatusMessage("Failed to save output profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="workspace-grid output-grid" role="region" aria-label="Output profile setup">
      <aside className="output-column output-column--left">
        <header className="workspace-panel__header">
          <h2>Profiles</h2>
          <button type="button" className="workspace-toolbar__btn">
            <Plus size={14} /> New
          </button>
        </header>
        <ul className="output-profile-list" role="list">
          {OUTPUT_PROFILES.map((profile) => (
            <li key={profile.id} role="listitem">
              <button
                type="button"
                className={`output-profile-list__item${selectedProfile.id === profile.id ? " is-active" : ""}`}
                onClick={() => setSelectedProfile(profile)}
              >
                <span className="output-profile-list__name">{profile.name}</span>
                <span className="output-profile-list__desc">{profile.description}</span>
                <span className="output-profile-list__date">Updated {profile.updatedAt}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="output-column output-column--center">
        <header className="workspace-panel__header">
          <h2>Column Mapping</h2>
          <div className="workspace-toolbar">
            <button type="button" className="workspace-toolbar__btn" onClick={handleSaveProfile} disabled={saving}>
              <Save size={14} />
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" className="workspace-toolbar__btn">
              <Upload size={14} /> Import
            </button>
          </div>
        </header>
        <table className="mapping-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Mapped</th>
              <th>Type</th>
              <th>Required</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_MAPPING.map((row) => (
              <tr key={row.source}>
                <td>{row.source}</td>
                <td>{row.mapped}</td>
                <td>{row.type}</td>
                <td>{row.required ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {statusMessage ? <p className="output-status">{statusMessage}</p> : null}
      </section>

      <aside className="output-column output-column--right">
        <header className="workspace-panel__header">
          <h2>Preview</h2>
          <select value={format} onChange={(event) => setFormat(event.target.value)}>
            <option value="CSV">CSV</option>
            <option value="XML">XML</option>
            <option value="JSON">JSON</option>
            <option value="Excel">Excel</option>
            <option value="ACCESS">ACCESS</option>
          </select>
        </header>
        <div className="output-preview" role="table">
          <table>
            <thead>
              <tr>
                {previewColumns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_PREVIEW.map((row, index) => (
                <tr key={index}>
                  {previewColumns.map((column) => (
                    <td key={column}>{row[column as keyof typeof row] ?? "-"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="output-preview__actions">
          <button type="button" className="btn-secondary">
            <DownloadCloud size={16} /> Download sample
          </button>
        </div>
      </aside>
    </div>
  );
}

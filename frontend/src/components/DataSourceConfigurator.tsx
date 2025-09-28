import type { DataSourceConfigModel } from "@app-types/workflow";
import { useMemo, useState } from "react";

interface DataSourceConfiguratorProps {
  config?: DataSourceConfigModel;
  onUpdateAccessPath: (path: string) => Promise<void>;
  onToggleBlueprint: (id: string, enabled: boolean) => Promise<void>;
  saving: boolean;
}

export function DataSourceConfigurator({ config, onUpdateAccessPath, onToggleBlueprint, saving }: DataSourceConfiguratorProps) {
  const [localPath, setLocalPath] = useState(config?.access_path ?? "");
  const palette = config?.shading_palette ?? {};

  const blueprintSwitches = useMemo(() => config?.blueprint_switches ?? [], [config?.blueprint_switches]);

  const handleSave = async () => {
    if (!localPath) return;
    await onUpdateAccessPath(localPath);
  };

  return (
    <section className="panel-card interactive-card">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">데이터 소스 설정</h2>
          <p className="panel-subtitle">Access 파일, 테이블, 블루프린트를 GUI에서 직접 제어합니다.</p>
        </div>
      </header>

      <div className="space-y-4 text-sm">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-accent-strong">Access 데이터 파일</span>
          <input
            type="text"
            value={localPath}
            onChange={(event) => setLocalPath(event.target.value)}
            placeholder="routing_data/ROUTING AUTO TEST.accdb"
            className="input-field"
          />
          <button type="button" className="btn-secondary mt-2" onClick={handleSave} disabled={saving}>
            {saving ? "저장 중" : "경로 저장"}
          </button>
        </label>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-accent-strong">테이블 요약</p>
          <ul className="space-y-2 text-xs text-muted">
            {config?.table_profiles.map((profile) => (
              <li key={profile.name} className="flex items-center justify-between rounded-xl bg-surface-weak px-3 py-2">
                <span className="font-semibold text-accent-soft">{profile.label}</span>
                <span>{profile.role}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-accent-strong">블루프린트 가능 영역</p>
          <div className="grid gap-2">
            {blueprintSwitches.map((toggle) => {
              const shade = toggle.enabled ? palette.allowed ?? "oklch(0.94 0.04 235)" : palette.disabled ?? "oklch(0.78 0.02 235)";
              const accent = toggle.enabled ? palette.highlight ?? "oklch(0.70 0.08 235)" : palette.restricted ?? "oklch(0.84 0.03 235)";
              return (
                <button
                  key={toggle.id}
                  type="button"
                  className="blueprint-chip"
                  style={{ background: shade, boxShadow: `0 0 0 1px ${accent}` }}
                  data-enabled={toggle.enabled}
                  onClick={() => onToggleBlueprint(toggle.id, !toggle.enabled)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{toggle.label}</span>
                    <span className="text-[11px] text-muted">{toggle.enabled ? "가능" : "비활성"}</span>
                  </div>
                  {toggle.description ? (
                    <p className="mt-1 text-[11px] text-muted">{toggle.description}</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

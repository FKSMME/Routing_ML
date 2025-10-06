import { Fragment } from "react";
import { AnimatedCard } from "./AnimatedCard";

interface FeatureWeightPanelProps {
  profiles: { name: string; description?: string | null; weights?: Record<string, number> }[];
  selectedProfile: string | null;
  onSelectProfile: (profile: string | null) => void;
  manualWeights: Record<string, number>;
  onChangeManualWeight: (feature: string, value: number) => void;
  onReset: () => void;
}

const CONTROL_FEATURES: { key: string; label: string }[] = [
  { key: "OUTDIAMETER", label: "외경" },
  { key: "SETUP_TIME", label: "세팅 시간" },
  { key: "MACH_WORKED_HOURS", label: "가공 시간" },
];

export function FeatureWeightPanel({
  profiles,
  selectedProfile,
  onSelectProfile,
  manualWeights,
  onChangeManualWeight,
  onReset,
}: FeatureWeightPanelProps) {
  return (
    <AnimatedCard enableHover className="panel-card interactive-card">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">Feature 가중치</h2>
          <p className="panel-subtitle">프로파일을 선택하거나 세부 가중치를 조정하세요.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onReset}>
          초기화
        </button>
      </header>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-accent-strong">프로파일</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {profiles.map((profile) => {
              const isSelected = profile.name === selectedProfile || (!selectedProfile && profile.name === "default");
              return (
                <button
                  key={profile.name}
                  type="button"
                  className="profile-chip"
                  data-selected={isSelected}
                  onClick={() => onSelectProfile(profile.name)}
                >
                  <span className="text-sm font-semibold">{profile.name}</span>
                  {profile.description ? (
                    <span className="block text-[11px] text-muted">{profile.description}</span>
                  ) : null}
                </button>
              );
            })}
            <button
              type="button"
              className="profile-chip"
              data-selected={!selectedProfile || selectedProfile === "custom"}
              onClick={() => onSelectProfile("custom")}
            >
              <span className="text-sm font-semibold">사용자 지정</span>
              <span className="block text-[11px] text-muted">슬라이더로 조정</span>
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-accent-strong">세부 가중치</p>
          {CONTROL_FEATURES.map((feature) => {
            const value = manualWeights[feature.key] ?? 1.0;
            return (
              <Fragment key={feature.key}>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{feature.label}</span>
                  <span>{value.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={400}
                  value={Math.round(value * 100)}
                  onChange={(event) => onChangeManualWeight(feature.key, Number(event.target.value) / 100)}
                  className="w-full accent-accent"
                />
              </Fragment>
            );
          })}
        </div>
      </div>
    </AnimatedCard>
  );
}

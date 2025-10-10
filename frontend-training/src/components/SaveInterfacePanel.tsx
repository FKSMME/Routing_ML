import { ROUTING_SAVE_CONTROL_IDS, RoutingGroupControls } from "@components/RoutingGroupControls";
import { useRoutingStore } from "@store/routingStore";
import { ClipboardList, HardDrive, Server, Settings, Sparkles, Workflow } from "lucide-react";
import { useMemo } from "react";

type ChannelKey = "server" | "local" | "clipboard" | "interface";

const CHANNELS: Array<{
  key: ChannelKey;
  label: string;
  description: string;
  icon: JSX.Element;
  controlId: (typeof ROUTING_SAVE_CONTROL_IDS)[keyof typeof ROUTING_SAVE_CONTROL_IDS];
}> = [
  {
    key: "server",
    label: "Server Save",
    description: "타임라인을 라우팅 그룹으로 저장하고 감사 로그를 남깁니다.",
    icon: <Server size={18} />,
    controlId: ROUTING_SAVE_CONTROL_IDS.primary,
  },
  {
    key: "local",
    label: "Local Export",
    description: "CSV · XML · JSON · Excel 형식으로 다운로드합니다.",
    icon: <HardDrive size={18} />,
    controlId: ROUTING_SAVE_CONTROL_IDS.localShortcut,
  },
  {
    key: "clipboard",
    label: "Clipboard Copy",
    description: "운영자에게 바로 공유할 수 있도록 텍스트로 복사합니다.",
    icon: <ClipboardList size={18} />,
    controlId: ROUTING_SAVE_CONTROL_IDS.clipboardShortcut,
  },
  {
    key: "interface",
    label: "ERP Interface",
    description: "ERP/MSSQL 연계를 트리거해 후속 프로세스를 실행합니다.",
    icon: <Settings size={18} />,
    controlId: ROUTING_SAVE_CONTROL_IDS.interface,
  },
];

export function SaveInterfacePanel() {
  const timelineLength = useRoutingStore((state) => state.timeline.length);
  const dirty = useRoutingStore((state) => state.dirty);
  const saving = useRoutingStore((state) => state.saving);
  const lastSavedAt = useRoutingStore((state) => state.lastSavedAt);
  const erpRequired = useRoutingStore((state) => state.erpRequired);
  const activeGroupName = useRoutingStore((state) => state.activeGroupName);

  const statusLabel = useMemo(() => {
    if (saving) {
      return "저장 중";
    }
    if (dirty) {
      return "변경됨";
    }
    if (lastSavedAt) {
      return `저장됨 ${new Date(lastSavedAt).toLocaleString()}`;
    }
    return "저장 전";
  }, [dirty, lastSavedAt, saving]);

  const handleFocusControl = (controlId: string) => {
    const element = document.getElementById(controlId);
    if (element instanceof HTMLElement) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.focus();
    }
  };

  return (
    <section className="panel-card interactive-card save-interface-panel">
      <header className="panel-header">
        <div>
          <h2 className="panel-title">SAVE · INTERFACE</h2>
          <p className="panel-subtitle">로컬/클립보드/서버 저장과 ERP 연계를 한 곳에서 제어합니다.</p>
        </div>
        <div className="save-interface-panel__meta">
          <span className="save-interface-panel__meta-item" aria-label="타임라인 단계">
            <Workflow size={14} /> {timelineLength} 단계
          </span>
          <span className={`save-interface-panel__badge${dirty ? " is-dirty" : ""}`}>{statusLabel}</span>
          <span className={`save-interface-panel__badge${erpRequired ? " is-active" : ""}`}>
            {erpRequired ? "ERP ON" : "ERP OFF"}
          </span>
        </div>
      </header>

      <div className="save-interface-panel__context">
        <Sparkles size={16} />
        <p>
          {activeGroupName ? (
            <>
              <strong>{activeGroupName}</strong> 그룹을 기준으로 저장 옵션이 구성되었습니다.
            </>
          ) : (
            "추천 라우팅을 그룹으로 저장해 ERP 연계를 준비하세요."
          )}
        </p>
      </div>

      <ul className="save-interface-panel__channels">
        {CHANNELS.map((channel) => (
          <li key={channel.key} className="save-interface-panel__channel">
            <div className="save-interface-panel__channel-icon" aria-hidden>
              {channel.icon}
            </div>
            <div className="save-interface-panel__channel-body">
              <h3>{channel.label}</h3>
              <p>{channel.description}</p>
              <button
                type="button"
                className="link-button"
                onClick={() => handleFocusControl(channel.controlId)}
              >
                패널에서 바로가기
              </button>
            </div>
          </li>
        ))}
      </ul>

      <RoutingGroupControls variant="embedded" />
    </section>
  );
}

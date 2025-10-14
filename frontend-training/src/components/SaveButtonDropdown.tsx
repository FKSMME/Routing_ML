import { Check, ChevronDown, Save, X } from "lucide-react";
import { type MouseEvent,useEffect, useRef, useState } from "react";

type FileFormat = "CSV" | "XML" | "JSON" | "Excel" | "ACCESS";
type Destination = "local" | "clipboard";

interface SaveOption {
  format: FileFormat;
  destination: Destination;
  enabled: boolean;
}

interface SaveButtonDropdownProps {
  onSave: (format: FileFormat, destination: Destination) => Promise<void>;
  disabled?: boolean;
  saving?: boolean;
  defaultFormat?: FileFormat;
  defaultDestination?: Destination;
}

const FORMAT_CAPABILITIES: Record<FileFormat, { local: boolean; clipboard: boolean }> = {
  CSV: { local: true, clipboard: true },
  XML: { local: true, clipboard: true },
  JSON: { local: true, clipboard: true },
  Excel: { local: true, clipboard: false },
  ACCESS: { local: false, clipboard: false },
};

const FORMAT_LABELS: Record<FileFormat, string> = {
  CSV: "CSV (쉼표 구분)",
  XML: "XML (구조화)",
  JSON: "JSON (개발용)",
  Excel: "Excel (*.xlsx)",
  ACCESS: "ACCESS DB",
};

export function SaveButtonDropdown({
  onSave,
  disabled = false,
  saving = false,
  defaultFormat = "CSV",
  defaultDestination = "local",
}: SaveButtonDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<FileFormat>(defaultFormat);
  const [selectedDestination, setSelectedDestination] = useState<Destination>(defaultDestination);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handlePrimarySave = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    try {
      await onSave(selectedFormat, selectedDestination);
      setToast({ message: `${selectedFormat} 저장 완료`, type: "success" });
    } catch (error) {
      setToast({ message: `저장 실패: ${error}`, type: "error" });
    }
  };

  const handleDropdownToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsOpen(!isOpen);
  };

  const handleFormatSelect = (format: FileFormat) => {
    setSelectedFormat(format);
    // Auto-select valid destination
    const caps = FORMAT_CAPABILITIES[format];
    if (!caps[selectedDestination]) {
      setSelectedDestination(caps.local ? "local" : "clipboard");
    }
  };

  const canSave = FORMAT_CAPABILITIES[selectedFormat][selectedDestination];

  return (
    <div className="save-button-group" ref={dropdownRef}>
      {/* Primary Save Button */}
      <button
        type="button"
        className="primary-button save-button-primary"
        onClick={handlePrimarySave}
        disabled={disabled || saving || !canSave}
        aria-label={`저장 (${selectedFormat} - ${selectedDestination === "local" ? "로컬" : "클립보드"})`}
      >
        <Save size={16} />
        {saving ? "저장 중..." : `저장 (${selectedFormat})`}
      </button>

      {/* Dropdown Toggle */}
      <button
        type="button"
        className="primary-button save-button-dropdown-toggle"
        onClick={handleDropdownToggle}
        disabled={disabled || saving}
        aria-label="저장 옵션 열기"
        aria-expanded={isOpen}
      >
        <ChevronDown size={16} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="save-dropdown-menu" role="menu" aria-label="저장 옵션">
          <div className="save-dropdown-section">
            <div className="save-dropdown-label">파일 형식</div>
            <div className="format-checkbox-group" role="radiogroup" aria-label="파일 형식 선택">
              {(Object.keys(FORMAT_CAPABILITIES) as FileFormat[]).map((format) => (
                <label key={format} className="format-checkbox-label">
                  <input
                    type="radio"
                    name="format"
                    value={format}
                    checked={selectedFormat === format}
                    onChange={() => handleFormatSelect(format)}
                    className="format-checkbox-input"
                  />
                  <span className="format-checkbox-custom"></span>
                  <span className="format-checkbox-text">
                    {FORMAT_LABELS[format]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="save-dropdown-section">
            <div className="save-dropdown-label">저장 위치</div>
            <div className="destination-checkbox-group" role="radiogroup" aria-label="저장 위치 선택">
              <label
                className={`destination-checkbox-label ${
                  !FORMAT_CAPABILITIES[selectedFormat].local ? "disabled" : ""
                }`}
              >
                <input
                  type="radio"
                  name="destination"
                  value="local"
                  checked={selectedDestination === "local"}
                  onChange={() => setSelectedDestination("local")}
                  disabled={!FORMAT_CAPABILITIES[selectedFormat].local}
                  className="destination-checkbox-input"
                />
                <span className="destination-checkbox-custom"></span>
                <span className="destination-checkbox-text">로컬 파일</span>
              </label>

              <label
                className={`destination-checkbox-label ${
                  !FORMAT_CAPABILITIES[selectedFormat].clipboard ? "disabled" : ""
                }`}
              >
                <input
                  type="radio"
                  name="destination"
                  value="clipboard"
                  checked={selectedDestination === "clipboard"}
                  onChange={() => setSelectedDestination("clipboard")}
                  disabled={!FORMAT_CAPABILITIES[selectedFormat].clipboard}
                  className="destination-checkbox-input"
                />
                <span className="destination-checkbox-custom"></span>
                <span className="destination-checkbox-text">클립보드</span>
              </label>
            </div>
          </div>

          <div className="save-dropdown-footer">
            <button
              type="button"
              className="save-dropdown-apply"
              onClick={handlePrimarySave}
              disabled={!canSave || saving}
            >
              <Check size={14} />
              적용 및 저장
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`save-toast-notification ${toast.type}`}
          role="alert"
          aria-live="polite"
        >
          {toast.type === "success" ? <Check size={16} /> : <X size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

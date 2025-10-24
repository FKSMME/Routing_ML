import { Save,X } from "lucide-react";
import React, { useEffect,useState } from "react";

interface DrawingViewerSettingsProps {
  open: boolean;
  onClose: () => void;
}

export interface DrawingViewerConfig {
  erpId: string;
  defaultSheet: string;
  width: number;
  height: number;
}

const DEFAULT_CONFIG: DrawingViewerConfig = {
  erpId: "",
  defaultSheet: "1",
  width: 1200,
  height: 800,
};

const STORAGE_KEY = "drawingViewerSettings";

/**
 * ERP 도면 조회 설정 다이얼로그
 *
 * 사용자의 ERP ID, 기본 시트 번호, 창 크기 등을 설정합니다.
 * 설정은 localStorage에 저장되어 세션 간 유지됩니다.
 */
export function DrawingViewerSettings({
  open,
  onClose,
}: DrawingViewerSettingsProps) {
  const [config, setConfig] = useState<DrawingViewerConfig>(DEFAULT_CONFIG);

  // 컴포넌트 마운트 시 저장된 설정 로드
  useEffect(() => {
    if (open) {
      const savedConfig = localStorage.getItem(STORAGE_KEY);
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          setConfig({ ...DEFAULT_CONFIG, ...parsed });
        } catch (error) {
          console.error("Failed to parse saved settings:", error);
        }
      }
    }
  }, [open]);

  const handleSave = () => {
    // 유효성 검증
    if (!config.erpId.trim()) {
      alert("ERP ID를 입력해주세요.");
      return;
    }

    if (config.width < 400 || config.width > 3840) {
      alert("창 너비는 400~3840 사이의 값이어야 합니다.");
      return;
    }

    if (config.height < 300 || config.height > 2160) {
      alert("창 높이는 300~2160 사이의 값이어야 합니다.");
      return;
    }

    // localStorage에 저장
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

      // 같은 탭에서도 설정 변경을 감지할 수 있도록 custom event 발생
      window.dispatchEvent(new CustomEvent("drawingViewerSettingsChanged", {
        detail: config
      }));

      alert("설정이 저장되었습니다.");
      onClose();
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("설정 저장에 실패했습니다.");
    }
  };

  const handleCancel = () => {
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">도면 조회 설정</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* General Help Text */}
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-md p-3">
            <p className="text-sm text-blue-200">
              ℹ️ ERP 시스템의 도면 조회 기능을 사용하기 위한 설정입니다. 설정은 브라우저에 저장됩니다.
            </p>
          </div>

          {/* ERP ID */}
          <div>
            <label
              htmlFor="erpId"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              ERP ID <span className="text-red-500">*</span>
            </label>
            <input
              id="erpId"
              type="text"
              value={config.erpId}
              onChange={(e) => setConfig({ ...config, erpId: e.target.value })}
              placeholder="사용자 ERP 아이디 입력"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              ERP 시스템에 로그인할 때 사용하는 아이디를 입력하세요.
            </p>
          </div>

          {/* 기본 시트 번호 */}
          <div>
            <label
              htmlFor="defaultSheet"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              기본 시트 번호
            </label>
            <input
              id="defaultSheet"
              type="text"
              value={config.defaultSheet}
              onChange={(e) =>
                setConfig({ ...config, defaultSheet: e.target.value })
              }
              placeholder="1"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              도면에 시트 번호가 없을 경우 사용할 기본값입니다.
            </p>
          </div>

          {/* 창 크기 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="width"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                창 너비 (px)
              </label>
              <input
                id="width"
                type="number"
                min="400"
                max="3840"
                value={config.width}
                onChange={(e) =>
                  setConfig({ ...config, width: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="height"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                창 높이 (px)
              </label>
              <input
                id="height"
                type="number"
                min="300"
                max="2160"
                value={config.height}
                onChange={(e) =>
                  setConfig({ ...config, height: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            도면 조회 창의 크기를 설정합니다. (권장: 1200x800)
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>저장</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * localStorage에서 저장된 설정을 로드하는 헬퍼 함수
 */
export function loadDrawingViewerSettings(): DrawingViewerConfig {
  const savedConfig = localStorage.getItem(STORAGE_KEY);
  if (savedConfig) {
    try {
      const parsed = JSON.parse(savedConfig);
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch (error) {
      console.error("Failed to parse saved settings:", error);
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

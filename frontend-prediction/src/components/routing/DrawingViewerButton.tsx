import { FileText, Loader2 } from "lucide-react";
import React, { useState } from "react";

import { useDrawingViewerSettings } from "../../hooks/useDrawingViewerSettings";
import { fetchDrawingInfo } from "../../lib/apiClient";
import { buildErpViewerUrl } from "../../utils/erpViewerUrl";

interface DrawingViewerButtonProps {
  itemCode: string;
  disabled?: boolean;
  className?: string;
}

/**
 * ERP 도면 조회 버튼 컴포넌트
 *
 * KSM ERP Image Viewer와 연동하여 품목의 기술 도면을 표시합니다.
 * MSSQL item_info 테이블에서 DRAW_NO, DRAW_REV를 조회하여 ERP 뷰어 URL을 생성합니다.
 */
export function DrawingViewerButton({
  itemCode,
  disabled = false,
  className = "",
}: DrawingViewerButtonProps) {
  const [loading, setLoading] = useState(false);
  const settings = useDrawingViewerSettings();

  const handleClick = async () => {
    if (!itemCode) {
      alert("품목을 먼저 선택해주세요.");
      return;
    }

    // ERP ID 확인
    if (!settings.erpId || settings.erpId.trim() === "") {
      alert("ERP ID를 설정해주세요. 설정 아이콘을 클릭하여 ERP ID를 입력하세요.");
      return;
    }

    setLoading(true);
    try {
      // 도면 정보 조회
      const drawingInfo = await fetchDrawingInfo(itemCode);

      if (!drawingInfo.available) {
        alert(`도면 정보를 찾을 수 없습니다.\n품목: ${itemCode}`);
        return;
      }

      // ERP Viewer URL 생성
      const url = buildErpViewerUrl({
        erpid: settings.erpId,
        pid: "1", // 1=Eng, 2=Doc
        dno: drawingInfo.drawingNumber,
        sheet: drawingInfo.sheetNumber || settings.defaultSheet || "1",
        rev: drawingInfo.revision,
      });

      // 새 창에서 ERP 뷰어 열기
      const windowFeatures = `width=${settings.width},height=${settings.height},menubar=no,toolbar=no,location=no,status=no`;
      const newWindow = window.open(url, "_blank", windowFeatures);

      if (!newWindow) {
        alert("팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.");
      }
    } catch (error) {
      console.error("도면 조회 중 오류 발생:", error);
      alert("도면 조회 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = disabled || loading || !itemCode;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      title={
        !itemCode
          ? "품목을 선택해주세요"
          : "선택한 품목의 기술 도면을 ERP 시스템에서 조회합니다"
      }
      className={`
        inline-flex items-center gap-2 px-4 py-2
        bg-blue-600 hover:bg-blue-700
        text-white font-medium rounded-md
        transition-colors duration-200
        disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50
        ${className}
      `}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>조회 중...</span>
        </>
      ) : (
        <>
          <FileText className="w-4 h-4" />
          <span>도면 조회</span>
        </>
      )}
    </button>
  );
}

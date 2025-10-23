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
    // Task 1.1: activeItemId 값 추적 로그
    console.log("[DrawingViewerButton] 도면 조회 시작 - itemCode:", itemCode);

    if (!itemCode) {
      console.warn("[DrawingViewerButton] 품목 코드가 없습니다");
      alert("품목을 먼저 선택해주세요.");
      return;
    }

    // ERP ID 확인
    if (!settings.erpId || settings.erpId.trim() === "") {
      console.warn("[DrawingViewerButton] ERP ID가 설정되지 않았습니다");
      alert("ERP ID를 설정해주세요. 설정 아이콘을 클릭하여 ERP ID를 입력하세요.");
      return;
    }

    setLoading(true);
    try {
      // 도면 정보 조회
      console.log("[DrawingViewerButton] API 호출 - fetchDrawingInfo:", itemCode);
      const drawingInfo = await fetchDrawingInfo(itemCode);
      console.log("[DrawingViewerButton] 도면 정보 조회 결과:", drawingInfo);

      // Task 1.2: 도면 정보 검증 강화
      if (!drawingInfo.available) {
        console.warn("[DrawingViewerButton] 도면 정보 없음 - itemCode:", itemCode);
        alert(
          `도면 정보를 찾을 수 없습니다.\n\n` +
          `품목: ${itemCode}\n` +
          `도면번호(DRAW_NO): ${drawingInfo.drawingNumber || '없음'}\n\n` +
          `ERP 마스터 데이터에 도면 정보가 등록되어 있는지 확인해주세요.`
        );
        return;
      }

      // DRAW_NO 검증
      if (!drawingInfo.drawingNumber || drawingInfo.drawingNumber.trim() === "") {
        console.error("[DrawingViewerButton] 도면 번호(DRAW_NO)가 비어있습니다");
        alert(
          `도면 번호(DRAW_NO)가 비어있습니다.\n\n` +
          `품목: ${itemCode}\n\n` +
          `ERP 마스터 데이터의 DRAW_NO 컬럼을 확인해주세요.`
        );
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
      console.log("[DrawingViewerButton] ERP Viewer URL 생성:", url);

      // 새 창에서 ERP 뷰어 열기
      const windowFeatures = `width=${settings.width},height=${settings.height},menubar=no,toolbar=no,location=no,status=no`;
      const newWindow = window.open(url, "_blank", windowFeatures);

      if (!newWindow) {
        console.warn("[DrawingViewerButton] 팝업이 차단되었습니다");
        alert(
          "팝업이 차단되었습니다.\n\n" +
          "브라우저 설정에서 팝업을 허용해주세요.\n" +
          "(주소창 오른쪽의 팝업 차단 아이콘을 클릭)"
        );
      } else {
        console.log("[DrawingViewerButton] 도면 조회 성공");
      }
    } catch (error) {
      console.error("[DrawingViewerButton] 도면 조회 중 오류 발생:", error);

      // Task 1.2: 에러 타입별 상세 메시지
      let errorMessage = "도면 조회 중 오류가 발생했습니다.";

      if (error instanceof Error) {
        if (error.message.includes("Network")) {
          errorMessage =
            "네트워크 오류가 발생했습니다.\n\n" +
            "인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.";
        } else if (error.message.includes("timeout")) {
          errorMessage =
            "서버 응답 시간이 초과되었습니다.\n\n" +
            "잠시 후 다시 시도해주세요.";
        } else {
          errorMessage =
            `도면 조회 중 오류가 발생했습니다.\n\n` +
            `오류 내용: ${error.message}\n\n` +
            `지속적으로 발생 시 관리자에게 문의하세요.`;
        }
      }

      alert(errorMessage);
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
          : "도면 조회: 선택한 품목의 기술 도면 보기"
      }
      className={`
        inline-flex items-center gap-2 px-4 py-2
        bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        text-white font-medium rounded-md
        transition-all duration-200
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

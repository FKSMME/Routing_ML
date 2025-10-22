/**
 * ERP Image Viewer URL 생성 유틸리티
 *
 * KSM ERP Image Viewer와 연동하기 위한 URL을 생성합니다.
 */

export interface ErpViewerParams {
  /**
   * 사용자 ERP ID
   */
  erpid: string;

  /**
   * 메뉴 ID
   * - 1: Engineering (도면)
   * - 2: Document
   */
  pid: string;

  /**
   * 도면 번호 (Drawing Number)
   * MSSQL item_info.DRAW_NO에서 조회
   */
  dno: string;

  /**
   * 시트 번호 (Sheet Number)
   * MSSQL item_info.DRAW_SHEET_NO 또는 설정된 기본값
   */
  sheet: string;

  /**
   * 리비전 (Revision)
   * MSSQL item_info.DRAW_REV에서 조회
   */
  rev: string;
}

/**
 * ERP Image Viewer URL 기본 주소
 */
const ERP_VIEWER_BASE_URL =
  "https://img.ksm.co.kr/WebViewer/View/Document/ErpImageViewer.aspx";

/**
 * ERP Image Viewer URL을 생성합니다.
 *
 * @param params - URL 파라미터
 * @returns 완성된 ERP Viewer URL
 *
 * @example
 * ```typescript
 * const url = buildErpViewerUrl({
 *   erpid: "USER123",
 *   pid: "1",
 *   dno: "DWG-2024-001",
 *   sheet: "1",
 *   rev: "A"
 * });
 * // https://img.ksm.co.kr/WebViewer/View/Document/ErpImageViewer.aspx?erpid=USER123&pid=1&dno=DWG-2024-001&sheet=1&rev=A
 * ```
 */
export function buildErpViewerUrl(params: ErpViewerParams): string {
  // URL 파라미터 검증
  if (!params.erpid || params.erpid.trim() === "") {
    throw new Error("ERP ID는 필수입니다.");
  }

  if (!params.dno || params.dno.trim() === "") {
    throw new Error("도면 번호는 필수입니다.");
  }

  // URLSearchParams를 사용하여 안전한 URL 인코딩
  const urlParams = new URLSearchParams({
    erpid: params.erpid.trim(),
    pid: params.pid || "1",
    dno: params.dno.trim(),
    sheet: params.sheet || "1",
    rev: params.rev || "",
  });

  return `${ERP_VIEWER_BASE_URL}?${urlParams.toString()}`;
}

/**
 * ERP Viewer URL이 유효한지 검증합니다.
 *
 * @param url - 검증할 URL
 * @returns 유효 여부
 */
export function validateErpViewerUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    // 기본 URL 확인
    if (!url.startsWith(ERP_VIEWER_BASE_URL)) {
      return false;
    }

    // 필수 파라미터 확인
    const erpid = urlObj.searchParams.get("erpid");
    const dno = urlObj.searchParams.get("dno");

    return !!(erpid && dno);
  } catch (error) {
    return false;
  }
}

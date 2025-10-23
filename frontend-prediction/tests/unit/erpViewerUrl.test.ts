import { describe, expect, it } from "vitest";

import { buildErpViewerUrl, validateErpViewerUrl } from "../../src/utils/erpViewerUrl";

describe("buildErpViewerUrl", () => {
  it("constructs a valid ERP viewer url with provided parameters", () => {
    const url = buildErpViewerUrl({
      erpid: "ENG_USER",
      pid: "2",
      dno: "DWG-2025-001",
      sheet: "5",
      rev: "C",
    });

    expect(url).toBe(
      "https://img.ksm.co.kr/WebViewer/View/Document/ErpImageViewer.aspx?erpid=ENG_USER&pid=2&dno=DWG-2025-001&sheet=5&rev=C",
    );
    expect(validateErpViewerUrl(url)).toBe(true);
  });

  it("applies default values for optional parameters and trims inputs", () => {
    const url = buildErpViewerUrl({
      erpid: "  designer01 ",
      pid: "",
      dno: "  DRAW-777 ",
      sheet: "",
      rev: "",
    });

    const parsed = new URL(url);

    expect(parsed.searchParams.get("erpid")).toBe("designer01");
    expect(parsed.searchParams.get("pid")).toBe("1");
    expect(parsed.searchParams.get("dno")).toBe("DRAW-777");
    expect(parsed.searchParams.get("sheet")).toBe("1");
    expect(parsed.searchParams.get("rev")).toBe("");
  });

  it("throws descriptive errors when mandatory fields are missing", () => {
    expect(() =>
      buildErpViewerUrl({
        erpid: "",
        pid: "1",
        dno: "DWG-500",
        sheet: "1",
        rev: "A",
      }),
    ).toThrow("ERP ID는 필수입니다.");

    expect(() =>
      buildErpViewerUrl({
        erpid: "designer",
        pid: "1",
        dno: "",
        sheet: "1",
        rev: "A",
      }),
    ).toThrow("도면 번호는 필수입니다.");
  });
});

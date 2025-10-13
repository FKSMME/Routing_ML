import type { OperationStep } from "@app-types/routing";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAddCustomRecommendation = vi.fn();
const mockUpdateCustomRecommendation = vi.fn();
const mockRemoveCustomRecommendation = vi.fn();
const mockHideRecommendation = vi.fn();
const mockRestoreRecommendation = vi.fn();
const mockRestoreAllRecommendations = vi.fn();

let mockState: any;

vi.mock("@store/routingStore", () => ({
  createRecommendationBucketKey: (itemCode: string, candidateId: string | null) =>
    `${itemCode}::${candidateId ?? "null"}`,
  createRecommendationOperationKey: (operation: OperationStep) =>
    `${operation.PROC_CD ?? ""}::${operation.PROC_SEQ ?? ""}`,
  useRoutingStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

import { CandidatePanel } from "@components/CandidatePanel";

const DEFAULT_OPERATION: OperationStep = {
  PROC_CD: "OP-100",
  PROC_SEQ: 10,
  PROC_DESC: "자동 절단",
  SETUP_TIME: 5,
  RUN_TIME: 12,
  WAIT_TIME: null,
};

const SECOND_OPERATION: OperationStep = {
  PROC_CD: "OP-200",
  PROC_SEQ: 20,
  PROC_DESC: "후처리",
  SETUP_TIME: null,
  RUN_TIME: 7,
  WAIT_TIME: null,
};

const CUSTOM_OPERATION: OperationStep = {
  PROC_CD: "CUS-900",
  PROC_SEQ: 90,
  PROC_DESC: "사용자 정의 공정",
  SETUP_TIME: 3,
  RUN_TIME: 4,
  WAIT_TIME: 1,
};

const createMockState = () => {
  const state: any = {
    activeProductId: "ITEM-1",
    processGroups: [],
    activeProcessGroupId: null,
    setActiveProcessGroup: vi.fn(),
    recommendations: [
      {
        itemCode: "ITEM-1",
        candidateId: "CAND-1",
        operations: [DEFAULT_OPERATION, SECOND_OPERATION],
      },
    ],
    customRecommendations: [
      {
        id: "custom-1",
        itemCode: "ITEM-1",
        candidateId: "CAND-1",
        operation: CUSTOM_OPERATION,
      },
    ],
    hiddenRecommendationKeys: { "ITEM-1::CAND-1": [] },
    insertOperation: vi.fn(),
    addCustomRecommendation: mockAddCustomRecommendation,
    updateCustomRecommendation: mockUpdateCustomRecommendation,
    removeCustomRecommendation: mockRemoveCustomRecommendation,
    hideRecommendation: mockHideRecommendation,
    restoreRecommendation: mockRestoreRecommendation,
    restoreAllRecommendations: mockRestoreAllRecommendations,
    loading: false,
    productTabs: [
      {
        id: "ITEM-1",
        productName: "고속 절단기",
        candidateId: "CAND-1",
      },
    ],
    timeline: [{ id: "timeline-1" }],
    dirty: false,
    lastSavedAt: undefined,
    erpRequired: false,
  };
  state.setERPRequired = vi.fn((value: boolean) => {
    mockState = { ...mockState, erpRequired: value };
  });
  return state;
};

beforeEach(() => {
  mockAddCustomRecommendation.mockReset();
  mockUpdateCustomRecommendation.mockReset();
  mockRemoveCustomRecommendation.mockReset();
  mockHideRecommendation.mockReset();
  mockRestoreRecommendation.mockReset();
  mockRestoreAllRecommendations.mockReset();
  mockState = createMockState();
});

describe("CandidatePanel", () => {
  it("opens the recommendation settings modal from the manage button", async () => {
    const user = userEvent.setup();
    render(<CandidatePanel />);

    const manageButtons = screen.getAllByRole("button", { name: "추천 관리" });
    await user.click(manageButtons[0]);

    expect(screen.getByRole("dialog", { name: "후보 공정 관리" })).toBeInTheDocument();
    expect(screen.getByText("사용자 정의 공정 추가")).toBeInTheDocument();
  });

  it("prefills the modal form when editing a custom recommendation from the list", async () => {
    const user = userEvent.setup();
    render(<CandidatePanel />);

    const editButtons = screen.getAllByRole("button", { name: "사용자 정의 공정 편집" });
    await user.click(editButtons[0]);

    const codeField = await screen.findByLabelText("공정 코드*");
    expect(codeField).toHaveValue("CUS-900");
    expect(screen.getByRole("button", { name: "공정 업데이트" })).toBeInTheDocument();
  });

  it("submits a new custom recommendation through the modal form", async () => {
    mockState.customRecommendations = [];
    const user = userEvent.setup();
    render(<CandidatePanel />);

    const manageButtons = screen.getAllByRole("button", { name: "추천 관리" });
    await user.click(manageButtons[0]);

    await user.type(screen.getByLabelText("공정 코드*"), "NEW-OP");
    await user.clear(screen.getByLabelText("순번*"));
    await user.type(screen.getByLabelText("순번*"), "30");
    await user.type(screen.getByLabelText("설명"), "신규 공정");

    await user.click(screen.getByRole("button", { name: "공정 추가" }));

    expect(mockAddCustomRecommendation).toHaveBeenCalledWith({
      itemCode: "ITEM-1",
      candidateId: "CAND-1",
      operation: expect.objectContaining({ PROC_CD: "NEW-OP", PROC_SEQ: 30 }),
    });
  });
});


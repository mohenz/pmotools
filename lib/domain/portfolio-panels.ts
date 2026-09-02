export const DEFAULT_PORTFOLIO_PANELS = [
  { key: "invitations", label: "초청 조회" },
  { key: "wbs-progress", label: "WBS 진척" },
  { key: "my-wbs-status", label: "나의 WBS 현황" },
] as const;

export type PortfolioPanelRow = { key: string; label: string; visible: boolean };

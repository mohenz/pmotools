import type { ReactNode } from "react";
import { MpLayout } from "@/features/mp/MpLayout";

// 결함관리(설계서: docs/결함관리 프로그램 설계서.md) — 다중 프로젝트(MP) 계열, 대상 프로젝트 선택 상자 사용.
export default function Layout({ children }: { children: ReactNode }) {
  return <MpLayout listHref="/mp-defects" feature="defects">{children}</MpLayout>;
}

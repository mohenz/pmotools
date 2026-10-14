import type { ReactNode } from "react";
import { MpLayout } from "@/features/mp/MpLayout";

// [WBS2 계열] 대상 프로젝트 선택 상자를 모든 하위 화면 상단에 둔다.
export default function Layout({ children }: { children: ReactNode }) {
  return <MpLayout listHref="/mp-wbs" feature="wbs">{children}</MpLayout>;
}

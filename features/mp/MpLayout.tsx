import type { ReactNode } from "react";
import { getPrisma } from "@/lib/server/db-pg";
import { getMpSelection } from "@/lib/server/mp/context";
import { MpProjectSelector } from "@/features/mp/MpProjectSelector";

type Feature = "wbs" | "work-logs" | "requirements" | "ut";

// 하위 프로젝트는 설정(공통코드·업무그룹)이 비어 있는 채로 선택될 수 있어, 등록 화면이 막히기 전에 무엇을 먼저 해야 하는지 알려 준다.
async function missingSetup(projectId: string, feature: Feature) {
  const prisma = getPrisma();
  if (feature === "wbs") {
    const tracks = await prisma.commonCode.count({ where: { projectId, isActive: true, group: { code: "WBS_WORK_GROUP", isActive: true } } });
    return tracks ? null : "이 프로젝트에 WBS Track 공통코드(WBS_WORK_GROUP)가 없습니다. 사용자 메뉴에서 이 프로젝트로 전환한 뒤 설정 → 공통코드에서 등록해 주세요.";
  }
  if (feature === "work-logs") {
    const groups = await prisma.groups.count({ where: { projectId, groupType: "WORK_MODULE", isActive: true } });
    return groups ? null : "이 프로젝트에 업무그룹이 없어 WBS상세내용을 작성할 수 없습니다. 이 프로젝트로 전환한 뒤 설정 → 그룹 관리에서 업무그룹과 소속을 지정해 주세요.";
  }
  if (feature === "ut") {
    const groups = await prisma.groups.count({ where: { projectId, groupType: "WORK_MODULE", isActive: true } });
    return groups ? null : "이 프로젝트에 업무그룹이 없어 단위테스트 시나리오를 등록할 수 없습니다. 이 프로젝트로 전환한 뒤 설정 → 그룹 관리에서 업무그룹을 등록해 주세요.";
  }
  return null;
}

// WBS2 · WBS상세내용2 · 요구사항관리2 공통 레이아웃 — 원본 메뉴와 섞이지 않도록 대상 프로젝트를 항상 화면 상단에 보여준다.
export async function MpLayout({ children, listHref, feature }: { children: ReactNode; listHref: string; feature: Feature }) {
  const { current, projects } = await getMpSelection();
  const notice = current ? await missingSetup(current.id, feature) : null;
  return <>
    {current && <MpProjectSelector projects={projects} currentId={current.id} listHref={listHref} />}
    {notice && <p className="mp-setup-notice" role="status">{notice}</p>}
    {children}
  </>;
}

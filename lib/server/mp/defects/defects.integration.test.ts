import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// 실제 PostgreSQL을 쓰는 통합 검증 — 이력 행은 삭제할 수 없으므로 운영·개발 DB에서는 실행하지 않는다.
// 마이그레이션을 적용한 임시 DB의 주소를 DEFECT_TEST_DATABASE_URL로 줄 때만 실행된다(없으면 건너뜀).
const url = process.env.DEFECT_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("결함관리 서버(임시 DB)", () => {
  type Mods = {
    prisma: ReturnType<typeof import("@/lib/server/db-pg").getPrisma>;
    d: typeof import("@/lib/server/mp/defects/defects");
    common: typeof import("@/lib/server/mp/defects/common");
    stats: typeof import("@/lib/server/mp/defects/stats");
    settings: typeof import("@/lib/server/mp/defects/settings");
    stages: typeof import("@/lib/server/mp/defects/stages");
    screens: typeof import("@/lib/server/mp/defects/screens");
    evidence: typeof import("@/lib/server/mp/defects/evidence");
  };
  let m: Mods;
  const ids = { project: "", admin: "", operator: "", worker: "", creator: "", outsider: "", group: "", wbs: "", ucase: "" };
  const ctx = (userId: string, role: string) => ({ projectId: ids.project, userId, role, jobTitle: null as string | null });
  const actors = () => ({ admin: ctx(ids.admin, "ADMIN"), operator: ctx(ids.operator, "OPERATOR"), worker: ctx(ids.worker, "MEMBER"), creator: ctx(ids.creator, "MEMBER"), outsider: ctx(ids.outsider, "MEMBER") });
  let codes: Awaited<ReturnType<Mods["common"]["getDefectCodes"]>>;
  let mainId = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.UT_EVIDENCE_ROOT = mkdtempSync(path.join(tmpdir(), "defect-ev-"));
    process.env.UT_EVIDENCE_TMP = mkdtempSync(path.join(tmpdir(), "defect-tmp-"));
    const db = await import("@/lib/server/db-pg");
    m = { prisma: db.getPrisma(), d: await import("@/lib/server/mp/defects/defects"), common: await import("@/lib/server/mp/defects/common"), stats: await import("@/lib/server/mp/defects/stats"),
      settings: await import("@/lib/server/mp/defects/settings"), stages: await import("@/lib/server/mp/defects/stages"), screens: await import("@/lib/server/mp/defects/screens"), evidence: await import("@/lib/server/mp/defects/evidence") };
    const p = m.prisma;
    const tag = Date.now().toString(36);
    const user = async (name: string, role: "ADMIN" | "OPERATOR" | "MEMBER") => (await p.user.create({ data: { userId: `t_${name}_${tag}`, name, passwordHash: "x", role } })).id;
    ids.admin = await user("관리자", "ADMIN"); ids.operator = await user("운영자", "OPERATOR"); ids.worker = await user("작업자", "MEMBER"); ids.creator = await user("등록자", "MEMBER"); ids.outsider = await user("외부인", "MEMBER");
    ids.project = (await p.project.create({ data: { code: `T${tag}`, name: "결함테스트" } })).id;
    for (const u of [ids.admin, ids.operator, ids.worker, ids.creator, ids.outsider]) await p.projectMember.create({ data: { projectId: ids.project, userId: u } });
    ids.group = (await p.groups.create({ data: { projectId: ids.project, groupType: "WORK_MODULE", code: "G1", label: "주문" } })).id;
    ids.wbs = (await p.wbsItem.create({ data: { displayId: `WBS-T${tag}`, projectId: ids.project, path: "0001", level: 1, name: "주문 개발", ownerUserId: ids.worker, createdBy: ids.admin } })).id;
    ids.ucase = (await p.utCase.create({ data: { projectId: ids.project, wbsItemId: ids.wbs, displayId: `UTC-T${tag}-001`, seq: 1, groupId: ids.group, name: "주문 저장", createdBy: ids.admin } })).id;
    await m.common.ensureDefectCommonCodes(ids.project);
    codes = await m.common.getDefectCodes(ids.project);
  }, 60_000);

  afterAll(async () => { await m?.prisma.$disconnect(); });

  const base = () => ({ title: "저장 버튼이 동작하지 않음", testStageCodeId: codes.stages.find((s) => s.code === "INTEGRATION")!.id, severityCodeId: codes.severities.find((s) => s.code === "CRITICAL")!.id });

  it("등록: 번호 5001부터, 이력 CREATE, 담당자 기본값은 WBS 작업자", async () => {
    const a = actors();
    const created = await m.d.createDefect(a.creator, { ...base(), caseId: ids.ucase });
    mainId = created.id;
    expect(created.displayId).toMatch(/^DF-\d{6}-5001$/);
    const detail = await m.d.getDefect(a.creator, mainId);
    expect(detail.assignee?.id).toBe(ids.worker);
    expect(detail.group?.label).toBe("주문");
    expect(detail.histories.map((h) => h.action)).toEqual(["CREATE"]);
    expect((await m.d.createDefect(a.creator, base())).displayId).toMatch(/-5002$/);
  });

  it("조회 범위: 관련 없는 사용자는 못 보고, 관련자·운영자는 본다", async () => {
    const a = actors();
    await expect(m.d.getDefect(a.outsider, mainId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await m.d.listDefects(a.outsider)).totalCount).toBe(0);
    expect((await m.d.listDefects(a.worker)).rows.some((r) => r.id === mainId)).toBe(true);
    expect((await m.d.listDefects(a.operator)).totalCount).toBeGreaterThanOrEqual(2);
  });

  it("권한: 등록자는 상태·담당자를 바꿀 수 없다", async () => {
    const a = actors();
    const d = await m.d.getDefect(a.creator, mainId);
    const done = codes.statuses.find((s) => s.code === "RESOLVED")!.id;
    await expect(m.d.updateDefect(a.creator, mainId, { statusCodeId: done, version: d.version })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(m.d.assignDefect(a.creator, mainId, { assigneeUserId: ids.creator, version: d.version })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(d.permissions).toMatchObject({ editSeverity: true, editAction: false, assign: false });
  });

  it("담당자 수정: 상태 변경 이력, 낡은 버전은 충돌", async () => {
    const a = actors();
    const d = await m.d.getDefect(a.worker, mainId);
    const done = codes.statuses.find((s) => s.code === "RESOLVED")!.id;
    await m.d.updateDefect(a.worker, mainId, { statusCodeId: done, actionComment: "수정 후 배포", version: d.version });
    const after = await m.d.getDefect(a.worker, mainId);
    expect(after.status.statusClass).toBe("DONE");
    expect(after.histories[0].action).toBe("STATUS");
    await expect(m.d.updateDefect(a.worker, mainId, { actionComment: "다시", version: d.version })).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  it("조치자 지정: 운영자는 가능, 프로젝트 구성원이 아니면 거부", async () => {
    const a = actors();
    const d = await m.d.getDefect(a.operator, mainId);
    await m.d.assignDefect(a.operator, mainId, { assigneeUserId: ids.creator, version: d.version });
    expect((await m.d.getDefect(a.operator, mainId)).assignee?.id).toBe(ids.creator);
    const other = await m.prisma.user.create({ data: { userId: `t_x_${Date.now()}`, name: "비구성원", passwordHash: "x" } });
    const d2 = await m.d.getDefect(a.operator, mainId);
    await expect(m.d.assignDefect(a.operator, mainId, { assigneeUserId: other.id, version: d2.version })).rejects.toMatchObject({ code: "INVALID_CODE" });
  });

  it("미배정·통계·조치 재확인", async () => {
    const a = actors();
    const unassigned = await m.d.listUnassignedDefects(a.operator);
    expect(unassigned.totalCount).toBe(1); // 두 번째 결함(케이스 없음)
    const s = await m.stats.getDefectStats(a.operator);
    expect(s.totals.total).toBe(2);
    expect(s.totals).toMatchObject({ done: 1, open: 1, unresolvedMajor: 1, unassigned: 1 });
    expect(s.byStage.map((g) => g.label)).toContain("통합");
    const recheck = await m.stats.listActionRecheck(a.operator);
    expect(recheck.some((r) => r.id === mainId)).toBe(false); // 조치 내용이 있으므로 재확인 대상 아님
  });

  it("이력은 수정·삭제할 수 없다(DB 트리거)", async () => {
    await expect(m.prisma.$executeRawUnsafe("UPDATE defect_histories SET actor_name = 'x'")).rejects.toThrow();
    await expect(m.prisma.$executeRawUnsafe("DELETE FROM defect_histories")).rejects.toThrow();
  });

  it("증적: 3개 제한과 열람", async () => {
    const a = actors();
    const png = () => new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], "cap.png", { type: "image/png" });
    await m.evidence.addDefectEvidence(a.creator, mainId, [png(), png()]);
    await expect(m.evidence.addDefectEvidence(a.creator, mainId, [png(), png()])).rejects.toMatchObject({ code: "INVALID_CODE" });
    const detail = await m.d.getDefect(a.creator, mainId);
    expect(detail.evidences).toHaveLength(2);
    const file = await m.evidence.openDefectEvidence(a.operator, detail.evidences[0].id);
    expect(file.bytes.length).toBe(7);
    await expect(m.evidence.openDefectEvidence(a.outsider, detail.evidences[0].id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("설정: 중대 기준·대상 도메인(권한 포함)", async () => {
    const a = actors();
    await expect(m.settings.setSeverityMajor(a.creator, { severityCodeId: codes.severities[0].id, isMajorImpact: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const sites = await m.settings.getDefectSettings(a.operator);
    expect(sites.sites.map((s) => s.origin)).toEqual(["http://localhost:8080", "http://localhost:8090"]);
    expect(await m.settings.isAllowedOrigin(ids.project, "http://localhost:8080")).toBe(true);
    expect(await m.settings.isAllowedOrigin(ids.project, "http://evil.test")).toBe(false);
    await m.settings.saveTargetSite(a.operator, { name: "x", origin: "http://example.test:9000", isActive: false });
    expect(await m.settings.isAllowedOrigin(ids.project, "http://example.test:9000")).toBe(false);
  });

  it("화면 목록: 엑셀 미리보기·오류 거부·반영·URL 매칭", async () => {
    const a = actors();
    const book = async (rows: string[][]) => {
      const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("s");
      ws.addRow(["화면경로", "화면 URL", "화면명", "사용 여부"]); rows.forEach((r) => ws.addRow(r));
      return new File([Buffer.from(await wb.xlsx.writeBuffer())], "screens.xlsx");
    };
    const bad = await m.screens.previewScreenImport(a.operator, await book([["", "x"], ["a", "http://t.test/a"]]));
    expect(bad.errorCount).toBeGreaterThan(0);
    await expect(m.screens.commitScreenImport(a.operator, await book([["", "x"]]))).rejects.toMatchObject({ code: "INVALID_STATE" });
    const good = await book([["주문 > 목록", "http://t.test/orders/*", "주문목록", "Y"], ["상품", "http://t.test/products", "", ""]]);
    expect((await m.screens.previewScreenImport(a.operator, good)).insertCount).toBe(2);
    expect(await m.screens.commitScreenImport(a.operator, good)).toEqual({ inserted: 2, updated: 0 });
    expect(await m.screens.commitScreenImport(a.operator, good)).toEqual({ inserted: 0, updated: 2 });
    expect((await m.screens.matchCollectedUrl(a.creator, "http://T.test/orders/12?x=1"))?.path).toBe("주문 > 목록");
    await expect(m.screens.commitScreenImport(a.creator, good)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("통계: 단위테스트 결함을 읽기 전용으로 합산하고 단위테스트 데이터는 바뀌지 않는다", async () => {
    const a = actors();
    const exec = await m.prisma.utExecution.create({ data: { projectId: ids.project, caseId: ids.ucase, wbsItemId: ids.wbs, roundNo: 1, executorId: ids.worker, executedOn: new Date(), verdict: "FAIL" } });
    await m.prisma.utDefect.create({ data: { projectId: ids.project, displayId: `DF-261024-0001`, executionId: exec.id, caseId: ids.ucase, wbsItemId: ids.wbs, description: "UT 결함", severity: "CRITICAL", status: "VERIFIED", foundAt: new Date(), createdBy: ids.worker } });
    const before = await m.prisma.utDefect.findMany();
    const withUt = await m.stats.getDefectStats(a.operator);
    const without = await m.stats.getDefectStats(a.operator, { includeUt: false });
    expect(withUt.bySource.ut).toBe(1);
    expect(withUt.totals.total).toBe(without.totals.total + 1);
    expect(withUt.byStage.map((g) => g.label)).toContain("단위테스트");
    expect(withUt.byTask.some((g) => g.label === "주문 개발")).toBe(true);
    expect(withUt.caseDensity.executedCases).toBe(1);
    expect(await m.prisma.utDefect.findMany()).toEqual(before); // 단위테스트 결함은 그대로
    expect((await m.stats.getDefectStats(a.outsider)).totals.total).toBe(0); // 관련 없는 사용자에게는 합산도 보이지 않는다
  });

  it("테스트 단계: 슈퍼관리자만 등록·잠금, 잠금된 단계는 선택지에서 빠지고 새 결함에 쓸 수 없다", async () => {
    const a = actors();
    const sup = await m.prisma.user.create({ data: { userId: `t_sup_${Date.now()}`, name: "슈퍼", passwordHash: "x", role: "SUPER_ADMIN" } });
    await expect(m.stages.listTestStages(ids.admin, ids.project)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const created = await m.stages.createTestStage(sup.id, ids.project, { label: "인수" });
    await expect(m.stages.createTestStage(sup.id, ids.project, { label: "인수" })).rejects.toMatchObject({ code: "INVALID_STATE" });
    let list = await m.stages.listTestStages(sup.id, ids.project);
    expect(list.map((x) => x.label)).toContain("인수");
    const unit = list.find((x) => x.label === "단위")!;
    await m.stages.saveTestStageLocks(sup.id, ids.project, { locks: { [created.id]: true, [unit.id]: true } });
    list = await m.stages.listTestStages(sup.id, ids.project);
    expect(list.filter((x) => x.locked).map((x) => x.label).sort()).toEqual(["단위", "인수"]);
    const codesNow = await m.common.getDefectCodes(ids.project);
    expect(codesNow.stages.map((x) => x.label)).not.toContain("단위");
    await expect(m.d.createDefect(a.creator, { title: "잠금된 단계로 등록", testStageCodeId: unit.id, severityCodeId: codes.severities[0].id })).rejects.toMatchObject({ code: "INVALID_CODE" });
    const all = Object.fromEntries(list.map((x) => [x.id, true]));
    await expect(m.stages.saveTestStageLocks(sup.id, ids.project, { locks: all })).rejects.toMatchObject({ code: "LAST_ACTIVE_CODE" });
    await m.stages.saveTestStageLocks(sup.id, ids.project, { locks: { [created.id]: false, [unit.id]: false } }); // 원복
    // 순서: 전체 목록을 거꾸로 저장하면 선택지·통계 순서가 그대로 따라간다
    list = await m.stages.listTestStages(sup.id, ids.project);
    const reversed = [...list].reverse().map((x) => x.id);
    await m.stages.saveTestStageLocks(sup.id, ids.project, { locks: {}, order: reversed });
    expect((await m.stages.listTestStages(sup.id, ids.project)).map((x) => x.id)).toEqual(reversed);
    expect((await m.common.getDefectCodes(ids.project)).stages.map((x) => x.id)).toEqual(reversed);
    await expect(m.stages.saveTestStageLocks(sup.id, ids.project, { locks: {}, order: reversed.slice(1) })).rejects.toMatchObject({ code: "INVALID_CODE" });
  });

  it("삭제: 관리자만, 목록에서 사라지고 이력은 남는다", async () => {
    const a = actors();
    await expect(m.d.deleteDefect(a.operator, mainId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await m.d.deleteDefect(a.admin, mainId);
    expect((await m.d.listDefects(a.admin)).rows.some((r) => r.id === mainId)).toBe(false);
    expect(await m.prisma.defectHistory.count({ where: { defectId: mainId, action: "DELETE" } })).toBe(1);
  });
});

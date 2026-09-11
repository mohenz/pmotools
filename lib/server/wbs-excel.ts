import "server-only";
import ExcelJS from "exceljs";
import { revalidateTag } from "next/cache";
import { codeFromPath, levelOf, pathFromCode, sortKeyFromCode } from "@/lib/domain/wbs";
import { getPrisma, actorNameOf, writeAuditLog } from "@/lib/server/db-pg";
import { assertManager } from "@/lib/server/permissions";
import { wbsTag } from "@/lib/server/cache-tags";
import { WBS_EXCEL_HEADERS, WBS_EXCEL_ROLE_NAMES, listWbsItemsExcelColumns, listWbsWorkGroups, loadHolidaySet, delayCompletionFields } from "@/lib/server/wbs";

const HEADER_LIST: readonly string[] = WBS_EXCEL_HEADERS;

// 엑셀 가장 왼쪽 컬럼 — 값이 없으면 해당 행은 그대로 두고, D는 삭제(보관), U는 기존 Task 수정, I는 신규 Task
// 삽입이다(2026-09-07 사용자 요청, I 추가는 같은 날 후속 요청). U는 코드가 이미 있어야 하고, I는 코드가 아직
// 없어야 한다 — 다운로드한 파일을 그대로 올리면 기존 행은 U, 새로 추가하는 행은 I로 구분해 쓰는 용도.
// WBS_EXCEL_HEADERS(다른 화면·엑셀 다운로드가 함께 쓰는 47개 컬럼 스키마)에는 넣지 않고 업로드/다운로드에서만 다룬다.
const IMPORT_ACTION_HEADER = "작업구분";
const ACTUAL_HEADERS = ["실적시작일", "실적종료일", "지연완료", "지연완료일자", "지연일자"];

export async function exportWbsSample(projectId: string): Promise<Buffer> {
  const existing = await getPrisma().wbsItem.findMany({ where: { projectId, archivedAt: null }, select: { path: true } });
  const roots = new Set(existing.map((item) => Number(item.path.split(".")[0])));
  let root = 1;
  while (roots.has(root)) root++;
  const headers = [IMPORT_ACTION_HEADER, ...WBS_EXCEL_HEADERS, ...ACTUAL_HEADERS];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("WBS", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(headers);
  const examples = [
    { code: String(root), name: "샘플 단계", end: "" },
    { code: `${root}.1`, name: "정상 완료 예시", end: "2026-09-04" },
    { code: `${root}.2`, name: "지연 완료 예시", end: "2026-09-08" },
    { code: `${root}.3`, name: "진행 중 예시", end: "" },
  ];
  for (const [index, example] of examples.entries()) {
    const values: Record<string, ExcelJS.CellValue> = {
      작업구분: "I", wbs_level: index ? 2 : 1, Stage: "샘플 단계", Task: example.code,
      "Task Description": example.name,
      StartDate: new Date("2026-09-01T00:00:00Z"), DueDate: new Date("2026-09-04T00:00:00Z"),
      실적시작일: index ? new Date("2026-09-01T00:00:00Z") : null,
      실적종료일: example.end ? new Date(`${example.end}T00:00:00Z`) : null,
    };
    sheet.addRow(headers.map((header) => values[header] ?? null));
  }
  sheet.columns.forEach((column, index) => {
    column.width = index === headers.indexOf("Task Description") ? 30 : 18;
    if (["StartDate", "DueDate", "실적시작일", "실적종료일", "지연완료일자"].includes(headers[index])) column.numFmt = "yyyy-mm-dd";
  });
  const guide = workbook.addWorksheet("작성안내");
  guide.addRows([
    ["항목", "작성 방법"],
    ["샘플", "신규 등록(I) 예시 4건입니다. Task 코드는 다운로드 시 현재 프로젝트에서 사용하지 않는 번호로 생성합니다."],
    ["작업구분", "I: 신규 등록, U: 기존 수정, D: 해당 행 삭제(보관), 공백: 유지"],
    ["기존 항목 수정", "현재 WBS 목록을 내려받아 작업구분을 U로 변경하세요. 샘플은 기존 데이터 수정용이 아닙니다."],
    ["날짜", "계획일과 실적일을 실제 일정에 맞게 수정하세요. 날짜 형식은 yyyy-mm-dd입니다."],
    ["실적일", "실적종료일을 입력하려면 실적시작일이 필요합니다. 종료일은 시작일보다 빠를 수 없습니다."],
    ["지연 계산", "오른쪽 지연완료·지연완료일자·지연일자는 비워 두세요. 업로드 시 주말·공휴일을 제외해 자동 계산합니다."],
    ["정상 완료", "정상 완료 예시의 지연완료는 0, 지연완료일자와 저장된 지연일수는 공백입니다."],
    ["지연 완료", "지연 완료 예시의 지연완료는 1, 지연완료일자는 2026-09-08이며 지연일수는 2일에서 등록된 공휴일을 제외합니다."],
    ["담당자·Track", "현재 프로젝트의 사용자ID와 WBS 업무그룹을 입력하세요. 샘플에서는 비워 두었습니다."],
    ["업로드", "파일을 선택하고 검증한 뒤 반영 대상 목록을 확인하세요. 반영하면 샘플 항목이 실제 등록됩니다."],
  ]);
  guide.columns = [{ width: 22 }, { width: 95 }];
  guide.getColumn(2).alignment = { wrapText: true, vertical: "middle" };
  for (const tab of [sheet, guide]) {
    tab.eachRow((row, index) => { row.height = index === 1 ? 55 : 32; });
    tab.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF243746" } };
      cell.alignment = { wrapText: true, vertical: "middle" };
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function exportWbsToExcel(projectId: string): Promise<Buffer> {
  const { rows } = await listWbsItemsExcelColumns(projectId, { pageSize: "all" });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("WBS");
  sheet.addRow([IMPORT_ACTION_HEADER, ...WBS_EXCEL_HEADERS, ...ACTUAL_HEADERS]);
  sheet.getRow(1).font = { bold: true };
  for (const item of rows) {
    sheet.addRow([
      "", item.level, sortKeyFromCode(item.code), item.projectCode, item.configStatus, item.stage ?? "", item.code, item.name, "",
      item.isLeaf ? 1 : "", item.ownerName ?? "", item.ownerLoginId ?? "", item.groupLabel ?? "", item.startDate ?? "", item.dueDate ?? "",
      item.deliverable?.note ?? "", item.deliverable?.isOfficial ? "Y" : "", item.deliverable?.fileUrl ?? "", item.sequenceNo,
      item.deliverable?.templateUrl ?? "", item.deliverable?.reviewerName ?? "", item.deliverable?.reviewedAt ?? "",
      item.workingDays ?? "", item.weight ?? item.workingDays ?? "", item.workingDays ?? "", Math.round(item.actualProgress * 100),
      ...item.roles.map((role) => (role.hasPermission ? 1 : "")),
      ...item.roles.map((role) => role.progressPercent),
      item.plannedProgress === null ? "" : Math.round(item.plannedProgress * 100),
      Math.round(item.actualProgress * 100),
      item.progressIndex === null ? "" : Math.round(item.progressIndex * 100),
      item.actualStartDate ?? "", item.actualDueDate ?? "", item.isDelayedCompletion ? 1 : 0,
      item.delayedCompletionDate ?? "", item.delayDays ?? "",
    ]);
  }
  sheet.columns.forEach((column) => { column.width = 16; });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export type WbsImportRowResult = { row: number; code: string; name: string; action: "" | "D" | "U" | "I"; errors: string[]; warnings: string[] };
export type WbsImportReport = {
  rows: WbsImportRowResult[]; validCount: number; errorCount: number;
  actionCounts: { blank: number; delete: number; update: number; insert: number };
};

type ParsedDeleteRow = { row: number; path: string; code: string; name: string };
type ParsedUpsertRow = {
  row: number; action: "U" | "I";
  path: string; level: number; name: string; configStatus: string;
  ownerUserId: string | null; ownerNameRaw: string; ownerLoginId: string; groupId: string | null;
  startDate: string | null; dueDate: string | null; weight: number | null;
  actualStartDate: string | null; actualDueDate: string | null;
  deliverable: { note: string; isOfficial: boolean; fileUrl: string; templateUrl: string; reviewerUserId: string | null; reviewedAt: string | null } | null;
  assignments: { groupId: string; progressPercent: number }[];
};

// Stage(레벨1 조상 이름)가 이 값이고 담당자를 확정하지 못했을 때(값이 없거나, 못 찾거나, 이름이 겹쳐서 등)
// 기본으로 지정할 사용자ID. 2026-08-30 사용자 요청: "stage가 기획이면 담당자는 사용자 id q93w36(이승연)으로
// 매핑" — 사용자ID·R&R(실행) 중 하나라도 실제로 확정되면 그 값이 우선하고, 둘 다 확정 실패했을 때만 적용한다.
const STAGE_DEFAULT_OWNER_LOGIN_ID: Record<string, string> = { "기획": "q93w36" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CODE_RE = /^\d+(\.\d+)*$/;

async function parseAndValidateWbsImport(projectId: string, buffer: Buffer): Promise<{
  report: WbsImportReport; deletes: ParsedDeleteRow[]; upserts: ParsedUpsertRow[]; existingIdByPath: Map<string, string>;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  // 공휴일 등 다른 시트가 함께 들어있는 파일도 있어 A1 헤더("wbs_level")로 실제 WBS 시트를 찾고, 못 찾으면 첫 시트로 되돌아간다.
  const sheet = workbook.worksheets.find((candidate) => {
    const row1 = candidate.getRow(1);
    return [row1.getCell(1).value, row1.getCell(2).value].some((v) => String(v ?? "").trim() === WBS_EXCEL_HEADERS[0]);
  }) ?? workbook.worksheets[0];
  const prisma = getPrisma();
  const [groups, members, existingItems] = await Promise.all([
    listWbsWorkGroups(projectId),
    prisma.projectMember.findMany({ where: { projectId, isActive: true, user: { status: "ACTIVE" } }, include: { user: true } }),
    prisma.wbsItem.findMany({ where: { projectId, archivedAt: null }, select: { id: true, path: true, actualStartDate: true, actualDueDate: true } }),
  ]);
  const existingIdByPath = new Map(existingItems.map((item) => [item.path, item.id]));
  const existingPaths = new Set(existingIdByPath.keys());
  const existingByPath = new Map(existingItems.map((item) => [item.path, item]));
  const groupsByLabel = new Map(groups.map((group) => [group.label, group]));
  const membersByName = new Map<string, string[]>();
  const membersByLoginId = new Map(members.map((member) => [member.user.userId, member.user.id]));
  for (const member of members) {
    const ids = membersByName.get(member.user.name) ?? [];
    ids.push(member.user.id);
    membersByName.set(member.user.name, ids);
  }
  function resolveMember(name: string, fieldLabel: string, warnings: string[]): string | null {
    if (!name) return null;
    const ids = membersByName.get(name);
    if (!ids || ids.length === 0) { warnings.push(`${fieldLabel}(${name})를 찾을 수 없어 미지정 처리됩니다.`); return null; }
    if (ids.length > 1) { warnings.push(`${fieldLabel}(${name})가 여러 명이라 미지정 처리됩니다.`); return null; }
    return ids[0];
  }
  // 담당자(R&R 실행) 전용 — 사용자ID가 있으면 이름보다 우선한다. 사용자ID·이름 어느 쪽으로도 확정하지 못하면
  // (값이 비어 있거나, 못 찾거나, 이름이 겹쳐 여러 명이거나 등 사유 불문) Stage 기본값을 최종 대체로 적용한다.
  function resolveOwner(loginId: string, name: string, stage: string | null, warnings: string[]): string | null {
    if (loginId) {
      const id = membersByLoginId.get(loginId);
      if (id) return id;
      warnings.push(`사용자ID(${loginId})를 찾을 수 없어 이름으로 다시 확인합니다.`);
    }
    const byName = resolveMember(name, "담당자", warnings);
    if (byName) return byName;
    const defaultLoginId = stage ? STAGE_DEFAULT_OWNER_LOGIN_ID[stage] : undefined;
    if (defaultLoginId) {
      const id = membersByLoginId.get(defaultLoginId);
      if (id) { warnings.push(`Stage(${stage}) 기본 담당자(${defaultLoginId})로 대체 지정되었습니다.`); return id; }
      warnings.push(`Stage(${stage}) 기본 담당자(${defaultLoginId})를 프로젝트에서 찾을 수 없어 미지정 처리됩니다.`);
    }
    return null;
  }

  // ExcelJS는 하이퍼링크 셀을 {text,hyperlink}, 리치텍스트를 {richText:[...]}, 수식을 {formula,result}로 반환한다.
  // String(value)로 바로 문자열화하면 이런 객체가 "[object Object]"로 저장되므로 실제 텍스트를 꺼내 쓴다.
  const cellText = (value: ExcelJS.CellValue): string => {
    if (value == null) return "";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object") {
      if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((r) => r.text).join("");
      if ("text" in value) { const text = String(value.text ?? "").trim(); return text || ("hyperlink" in value ? String(value.hyperlink ?? "") : ""); }
      if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
      if ("hyperlink" in value) return String(value.hyperlink ?? "");
      return "";
    }
    return String(value);
  };
  // 원본 엑셀은 우리 스키마(WBS_EXCEL_HEADERS)에 없는 빈 스페이서 열이 중간에 섞여 있을 수 있어(예: DueDate와
  // Deliverables 사이) 컬럼 순번 고정 매핑은 위험하다 — 파일 자체의 1행 헤더 텍스트로 열 위치를 찾는다.
  // 리치텍스트로 줄바꿈이 섞여 들어오는 헤더도 있어 공백을 전부 제거하고 비교한다.
  const norm = (s: string) => s.replace(/\s+/g, "");
  const headerIndexByText = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, idx) => { const text = norm(cellText(cell.value)); if (text) headerIndexByText.set(text, idx); });
  const col = (label: string) => headerIndexByText.get(norm(label)) ?? (HEADER_LIST.indexOf(label) + 1);
  const cellAt = (row: ExcelJS.Row, label: string) => cellText(row.getCell(col(label)).value).trim();
  // 사용자ID·작업구분은 기존 47개 컬럼 서식에 없던 신규 컬럼이라, 헤더 텍스트로 못 찾으면(구버전 파일) 위치 추정 폴백을
  // 쓰지 않는다 — 폴백을 쓰면 구버전 파일의 다른 컬럼 값이 잘못 읽힌다.
  const cellAtIfHeaderPresent = (row: ExcelJS.Row, label: string) => (headerIndexByText.has(norm(label)) ? cellAt(row, label) : "");

  const formatUtcDate = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  // 엑셀에서 직접 편집한 파일은 셀 값이 "YYYY-MM-DD" 텍스트가 아니라 실제 Date, 엑셀 일련번호(숫자),
  // 또는 "-"/"."/"/" 구분자에 자릿수가 다른 문자열("2026.7.20" 등)로 들어오는 경우가 많아 최대한 폭넓게 처리한다.
  const cellDateAt = (row: ExcelJS.Row, label: string) => {
    const raw = row.getCell(col(label)).value;
    if (raw instanceof Date) return formatUtcDate(raw);
    if (raw && typeof raw === "object" && "result" in raw) {
      const result = (raw as { result: unknown }).result;
      if (result instanceof Date) return formatUtcDate(result);
      if (typeof result === "number") return formatUtcDate(new Date(Date.UTC(1899, 11, 30) + result * 86_400_000));
    }
    if (typeof raw === "number") return formatUtcDate(new Date(Date.UTC(1899, 11, 30) + raw * 86_400_000));
    const text = String(raw ?? "").trim();
    const match = text.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
    if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    return text;
  };

  const rows: WbsImportRowResult[] = [];
  const deletes: ParsedDeleteRow[] = [];
  const upserts: ParsedUpsertRow[] = [];
  const seenPaths = new Set<string>();
  // Stage(엑셀 E열) = 최상위(레벨1) 조상의 이름 — 상위 행이 하위 행보다 먼저 나온다는 검증 규칙 덕분에 행을
  // 순서대로 훑으면서 "path의 첫 세그먼트 → 그 레벨1 행의 이름"만 기록해두면 매 행의 Stage를 즉석에서 구할 수 있다.
  const stageNameByRootPath = new Map<string, string>();
  let blankCount = 0, deleteRawCount = 0, updateRawCount = 0, insertRawCount = 0;

  const hasActionColumn = headerIndexByText.has(norm(IMPORT_ACTION_HEADER));
  if (!hasActionColumn) {
    rows.push({
      row: 1, code: "", name: "(파일 형식)", action: "",
      errors: [`'${IMPORT_ACTION_HEADER}' 컬럼을 찾을 수 없습니다. 엑셀을 다시 내려받아 가장 왼쪽 컬럼에 작업구분(공백/D/U/I)을 입력한 뒤 업로드해 주세요.`],
      warnings: [],
    });
    return { report: { rows, validCount: 0, errorCount: 1, actionCounts: { blank: 0, delete: 0, update: 0, insert: 0 } }, deletes, upserts, existingIdByPath };
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const code = cellAt(row, "Task");
    const name = cellAt(row, "Task Description");
    const actionRaw = cellAt(row, IMPORT_ACTION_HEADER).toUpperCase();
    if (!code && !name && !actionRaw) return; // 완전히 빈 행은 건너뛴다.

    const errors: string[] = [];
    const warnings: string[] = [];
    const action: "" | "D" | "U" | "I" = actionRaw === "D" || actionRaw === "U" || actionRaw === "I" ? actionRaw : "";
    if (actionRaw && !action) errors.push(`작업구분 값은 공백/D/U/I만 가능합니다(${actionRaw}).`);
    if (action === "D") deleteRawCount++; else if (action === "U") updateRawCount++; else if (action === "I") insertRawCount++; else blankCount++;

    const codeValid = CODE_RE.test(code);
    if (!codeValid) errors.push(`Task 코드 형식이 올바르지 않습니다(${code || "빈 값"}).`);
    if (!name && (action === "U" || action === "I")) errors.push("Task Description은 필수입니다.");

    const path = codeValid ? pathFromCode(code) : "";
    let stage: string | null = null;
    if (path) {
      if (seenPaths.has(path)) errors.push(`Task 코드가 중복됩니다(${code}).`);
      const level = levelOf(path);
      if (level > 1 && (action === "U" || action === "I")) {
        const parentPath = path.split(".").slice(0, -1).join(".");
        if (!seenPaths.has(parentPath) && !existingPaths.has(parentPath)) errors.push(`상위 Task(${codeFromPath(parentPath)})가 없습니다. 상위 Task가 이미 등록되어 있거나 이 행보다 앞에 있어야 합니다.`);
      }
      if (action === "U" && !existingPaths.has(path)) errors.push(`수정 대상 Task를 찾을 수 없습니다(${code}). 신규 등록이면 작업구분을 I로 입력해 주세요.`);
      if (action === "I" && existingPaths.has(path)) errors.push(`이미 등록된 Task 코드입니다(${code}). 수정이면 작업구분을 U로 입력해 주세요.`);
      seenPaths.add(path);
      const rootPath = path.split(".")[0];
      if (level === 1) { stage = name || null; if (name) stageNameByRootPath.set(rootPath, name); }
      else stage = stageNameByRootPath.get(rootPath) ?? null;
    }

    if (action === "D") {
      if (path && !errors.length && !existingPaths.has(path)) warnings.push("삭제 대상 Task를 찾을 수 없습니다(이미 삭제되었거나 존재하지 않는 코드).");
      rows.push({ row: rowNumber, code, name: name || "(이름 없음)", action, errors, warnings });
      if (!errors.length && path) deletes.push({ row: rowNumber, path, code, name: name || "(이름 없음)" });
      return;
    }
    if (action === "") { rows.push({ row: rowNumber, code, name: name || "(이름 없음)", action, errors, warnings }); return; }

    // action === "U" | "I" — 수정 또는 신규 삽입할 값을 파싱한다.
    const startDate = cellDateAt(row, "StartDate");
    const dueDate = cellDateAt(row, "DueDate");
    if (startDate && !DATE_RE.test(startDate)) errors.push("StartDate 형식이 올바르지 않습니다(YYYY-MM-DD).");
    if (dueDate && !DATE_RE.test(dueDate)) errors.push("DueDate 형식이 올바르지 않습니다(YYYY-MM-DD).");
    // 구버전 파일의 누락 컬럼은 기존 값을 유지하고, 포함된 컬럼의 공백은 날짜를 지운다.
    const existing = existingByPath.get(path);
    const actualStartDate = headerIndexByText.has(norm("실적시작일"))
      ? cellDateAt(row, "실적시작일") : existing?.actualStartDate?.toISOString().slice(0, 10) ?? "";
    const actualDueDate = headerIndexByText.has(norm("실적종료일"))
      ? cellDateAt(row, "실적종료일") : existing?.actualDueDate?.toISOString().slice(0, 10) ?? "";
    const validDate = (value: string) => DATE_RE.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    for (const [label, value] of [["실적시작일", actualStartDate], ["실적종료일", actualDueDate]]) {
      if (value && !validDate(value)) errors.push(`${label}에 유효한 날짜를 입력해 주세요(YYYY-MM-DD).`);
    }
    if (actualDueDate && !actualStartDate) errors.push("실적시작일이 없으면 실적종료일을 입력할 수 없습니다.");
    if (actualStartDate && actualDueDate && actualDueDate < actualStartDate) errors.push("실적종료일은 실적시작일보다 빠를 수 없습니다.");
    if (dueDate && !validDate(dueDate) && DATE_RE.test(dueDate)) errors.push("DueDate에 유효한 날짜를 입력해 주세요.");

    const weightRaw = cellAt(row, "가중치(입력불필요)");
    const weight = weightRaw ? Number(weightRaw) : null;
    if (weightRaw && !Number.isFinite(weight)) errors.push("가중치는 숫자여야 합니다.");

    const ownerName = cellAt(row, "R&R(실행)");
    const ownerLoginId = cellAtIfHeaderPresent(row, "사용자ID");
    const ownerUserId = resolveOwner(ownerLoginId, ownerName, stage, warnings);
    const trackLabel = cellAt(row, "R&R(지원)(모듈)");
    let groupId: string | null = null;
    if (trackLabel) {
      const group = groupsByLabel.get(trackLabel);
      if (!group) warnings.push(`Track(${trackLabel})을 찾을 수 없어 미지정 처리됩니다.`);
      else groupId = group.id;
    }

    const note = cellAt(row, "Deliverables(이슈 및 사유)");
    const isOfficial = cellAt(row, "공식여부(입력불필요)") === "Y";
    const fileUrl = cellAt(row, "파일위치(입력불필요)");
    const templateUrl = cellAt(row, "산출물템플릿(입력불필요)");
    const reviewerName = cellAt(row, "검수자(입력불필요)");
    const reviewerUserId = resolveMember(reviewerName, "검수자", warnings);
    const reviewedAt = cellDateAt(row, "검수실행일(입력불필요)");
    if (reviewedAt && !DATE_RE.test(reviewedAt)) errors.push("검수실행일 형식이 올바르지 않습니다(YYYY-MM-DD).");
    const hasDeliverable = Boolean(note || isOfficial || fileUrl || templateUrl || reviewerName || reviewedAt);

    const assignments: { groupId: string; progressPercent: number }[] = [];
    for (const role of WBS_EXCEL_ROLE_NAMES) {
      const hasPermission = cellAt(row, `${role}(진척등록권한)`) === "1";
      const pctRaw = cellAt(row, `${role}(진도율)`);
      const percent = pctRaw ? Number(pctRaw) : 0;
      if (pctRaw && !Number.isFinite(percent)) errors.push(`${role} 진도율은 숫자여야 합니다.`);
      if (hasPermission) {
        const group = groupsByLabel.get(role);
        if (!group) warnings.push(`역할(${role})에 해당하는 Track이 없어 진척권한을 반영하지 못했습니다.`);
        else assignments.push({ groupId: group.id, progressPercent: Math.min(100, Math.max(0, Math.round(percent))) });
      }
    }

    rows.push({ row: rowNumber, code, name: name || "(이름 없음)", action, errors, warnings });
    if (!errors.length && path && (action === "U" || action === "I")) upserts.push({
      row: rowNumber, action, path, level: levelOf(path), name, configStatus: cellAt(row, "Confing Status"),
      ownerUserId, ownerNameRaw: ownerName, ownerLoginId, groupId, startDate: startDate || null, dueDate: dueDate || null, weight,
      actualStartDate: actualStartDate || null, actualDueDate: actualDueDate || null,
      deliverable: hasDeliverable ? { note, isOfficial, fileUrl, templateUrl, reviewerUserId, reviewedAt: reviewedAt || null } : null,
      assignments,
    });
  });

  const errorCount = rows.filter((row) => row.errors.length > 0).length;
  return {
    report: { rows, validCount: rows.length - errorCount, errorCount, actionCounts: { blank: blankCount, delete: deleteRawCount, update: updateRawCount, insert: insertRawCount } },
    deletes, upserts, existingIdByPath,
  };
}

export async function validateWbsImport(projectId: string, buffer: Buffer): Promise<WbsImportReport> {
  const { report } = await parseAndValidateWbsImport(projectId, buffer);
  return report;
}

export type WbsImportApplyResultRow = { row: number; code: string; name: string; action: "D" | "U" | "I"; outcome: "deleted" | "delete_not_found" | "created" | "updated" };
export type WbsImportApplyResult = {
  counts: {
    blank: number; markedDelete: number; markedUpdate: number; markedInsert: number;
    deleted: number; deleteNotFound: number; created: number; updated: number;
  };
  rows: WbsImportApplyResultRow[];
};

// 부분 반영 — 작업구분이 빈 행은 건드리지 않고, D는 보관 처리, U는 기존 Task 수정, I는 신규 Task 삽입한다
// (U는 코드가 이미 있어야, I는 코드가 없어야 검증을 통과하므로 여기서는 존재 여부로 분기해도 항상 일치한다).
// 하위 Task까지 함께 삭제하지는 않는다(2026-09-07 사용자 확정 — 해당 행만 삭제).
export async function applyWbsImport(projectId: string, userId: string, buffer: Buffer): Promise<{ report: WbsImportReport; result: WbsImportApplyResult | null }> {
  await assertManager(projectId, userId);
  const { report, deletes, upserts, existingIdByPath } = await parseAndValidateWbsImport(projectId, buffer);
  if (report.errorCount > 0) return { report, result: null };

  const prisma = getPrisma();
  const actorName = await actorNameOf(userId);
  const holidays = await loadHolidaySet(projectId);
  const sortedUpserts = [...upserts].sort((a, b) => a.path.localeCompare(b.path));
  const idByPath = new Map(existingIdByPath);
  const resultRows: WbsImportApplyResultRow[] = [];
  let deletedCount = 0, deleteNotFoundCount = 0, createdCount = 0, updatedCount = 0;
  const year = new Date().getUTCFullYear();

  await prisma.$transaction(async (tx) => {
    for (const del of deletes) {
      const existingId = idByPath.get(del.path);
      if (!existingId) {
        deleteNotFoundCount++;
        resultRows.push({ row: del.row, code: del.code, name: del.name, action: "D", outcome: "delete_not_found" });
        continue;
      }
      await tx.wbsItem.update({ where: { id: existingId }, data: { archivedAt: new Date(), version: { increment: 1 } } });
      await tx.wbsItemEvent.create({ data: { wbsItemId: existingId, eventType: "archived", actorId: userId, actorName, body: "엑셀 업로드(작업구분 D)로 보관 처리" } });
      deletedCount++;
      resultRows.push({ row: del.row, code: del.code, name: del.name, action: "D", outcome: "deleted" });
    }

    const sequenceRow = await tx.wbsItemSequence.findUnique({ where: { projectId } });
    let sequenceValue = sequenceRow?.value ?? 0;

    for (const up of sortedUpserts) {
      const code = codeFromPath(up.path);
      const parentPath = up.level > 1 ? up.path.split(".").slice(0, -1).join(".") : null;
      const parentId = parentPath ? (idByPath.get(parentPath) ?? null) : null;
      const existingId = idByPath.get(up.path);
      // 엑셀의 지연 결과값은 신뢰하지 않고 화면과 같은 영업일 계산으로 확정한다.
      const actualFields = {
        actualStartDate: up.actualStartDate ? new Date(up.actualStartDate) : null,
        actualDueDate: up.actualDueDate ? new Date(up.actualDueDate) : null,
        ...delayCompletionFields(up.dueDate, up.actualDueDate, holidays),
      };
      const deliverableData = up.deliverable ? {
        note: up.deliverable.note, isOfficial: up.deliverable.isOfficial, fileUrl: up.deliverable.fileUrl, templateUrl: up.deliverable.templateUrl,
        reviewerUserId: up.deliverable.reviewerUserId, reviewedAt: up.deliverable.reviewedAt ? new Date(up.deliverable.reviewedAt) : null,
      } : null;

      if (existingId) {
        await tx.wbsItem.update({
          where: { id: existingId },
          data: {
            parentId, name: up.name,
            ...actualFields,
            ...(up.actualDueDate ? { status: "completed" as const } : {}),
            ownerUserId: up.ownerUserId, ownerNameRaw: up.ownerUserId ? "" : up.ownerNameRaw, ownerLoginId: up.ownerUserId ? "" : up.ownerLoginId, groupId: up.groupId,
            startDate: up.startDate ? new Date(up.startDate) : null, dueDate: up.dueDate ? new Date(up.dueDate) : null,
            configStatus: up.configStatus, weight: up.weight ?? null, version: { increment: 1 },
          },
        });
        await tx.wbsAssignment.deleteMany({ where: { wbsItemId: existingId } });
        if (up.assignments.length) await tx.wbsAssignment.createMany({ data: up.assignments.map((a) => ({ wbsItemId: existingId, groupId: a.groupId, progressPercent: up.actualDueDate ? 100 : a.progressPercent, updatedBy: userId })) });
        if (deliverableData) await tx.wbsDeliverable.upsert({ where: { wbsItemId: existingId }, create: { wbsItemId: existingId, ...deliverableData }, update: deliverableData });
        else await tx.wbsDeliverable.deleteMany({ where: { wbsItemId: existingId } });
        updatedCount++;
        resultRows.push({ row: up.row, code, name: up.name, action: up.action, outcome: "updated" });
      } else {
        const id = crypto.randomUUID();
        sequenceValue += 1;
        const displayId = `WBS-${year}-${String(sequenceValue).padStart(6, "0")}`;
        await tx.wbsItem.create({
          data: {
            id, displayId, projectId, parentId, path: up.path, level: up.level, name: up.name, description: "",
            ...actualFields,
            ownerUserId: up.ownerUserId, ownerNameRaw: up.ownerUserId ? "" : up.ownerNameRaw, ownerLoginId: up.ownerUserId ? "" : up.ownerLoginId, groupId: up.groupId,
            startDate: up.startDate ? new Date(up.startDate) : null, dueDate: up.dueDate ? new Date(up.dueDate) : null,
            status: up.actualDueDate ? "completed" : "not_started", configStatus: up.configStatus, weight: up.weight ?? null, createdBy: userId,
          },
        });
        if (up.assignments.length) await tx.wbsAssignment.createMany({ data: up.assignments.map((a) => ({ wbsItemId: id, groupId: a.groupId, progressPercent: up.actualDueDate ? 100 : a.progressPercent, updatedBy: userId })) });
        if (deliverableData) await tx.wbsDeliverable.create({ data: { wbsItemId: id, ...deliverableData } });
        idByPath.set(up.path, id);
        createdCount++;
        resultRows.push({ row: up.row, code, name: up.name, action: up.action, outcome: "created" });
      }
    }

    await tx.wbsItemSequence.upsert({ where: { projectId }, create: { projectId, value: sequenceValue }, update: { value: sequenceValue } });
  }, { timeout: 120_000 });

  const result: WbsImportApplyResult = {
    counts: {
      blank: report.actionCounts.blank, markedDelete: report.actionCounts.delete, markedUpdate: report.actionCounts.update, markedInsert: report.actionCounts.insert,
      deleted: deletedCount, deleteNotFound: deleteNotFoundCount, created: createdCount, updated: updatedCount,
    },
    rows: resultRows,
  };
  await writeAuditLog(projectId, userId, "WBS_EXCEL_IMPORT_PATCH", "wbs_items", projectId, null, result.counts);
  revalidateTag(wbsTag(projectId));
  return { report, result };
}

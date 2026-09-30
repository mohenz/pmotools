import { formatSessions, MEETING_MINUTE_PROJECT_TITLE } from "@/lib/domain/meeting-minutes";
import type { MeetingMinuteDetail, MeetingMinuteEntryRow } from "@/lib/server/meeting-minutes";

// 회의록 양식(EOCP_*.pdf)과 같은 표 배치 — 상세 화면과 인쇄(PDF) 화면이 함께 쓴다.
// 빈 섹션도 양식처럼 최소 행을 남겨 인쇄본에 수기로 적을 칸이 보이게 한다.
const pad = <T,>(rows: T[], min: number, blank: T) => (rows.length >= min ? rows : [...rows, ...Array.from({ length: min - rows.length }, () => blank)]);
const BLANK_ENTRY: MeetingMinuteEntryRow = { content: "", remark: "", plannedSchedule: "" };
const dot = (date: string) => (date ? date.replaceAll("-", ".") : "");
const names = (minute: MeetingMinuteDetail, side: "CUSTOMER" | "VENDOR") => minute.attendees.filter((a) => a.side === side).map((a) => a.name).join(", ");

export function MeetingMinuteDocument({ minute }: { minute: MeetingMinuteDetail }) {
  return <article className="minute-doc">
    <table className="minute-doc-head"><tbody>
      <tr><th className="minute-doc-title">회의록</th><th rowSpan={1}>서명</th><th>PM</th><th>발주사</th></tr>
      <tr><td className="minute-doc-project">{MEETING_MINUTE_PROJECT_TITLE}</td><td className="minute-doc-sign" /><td>{minute.signature.pmName}</td><td>{minute.signature.customerName}</td></tr>
    </tbody></table>

    <table className="minute-doc-info"><tbody>
      <tr><th>회의 일자</th><td colSpan={2}>{dot(minute.meetingDate)} {formatSessions(minute.sessions)}</td></tr>
      <tr><th>회의 장소</th><td colSpan={2}>{minute.location}</td></tr>
      <tr><th rowSpan={2}>참석자</th><th className="minute-doc-side">발주사</th><td>{names(minute, "CUSTOMER")}</td></tr>
      <tr><th className="minute-doc-side">수행사</th><td>{names(minute, "VENDOR")}</td></tr>
      <tr><th>작성자</th><td colSpan={2}>{minute.authorName}</td></tr>
      <tr><th>회의 안건</th><td colSpan={2}>{minute.title}</td></tr>
    </tbody></table>

    <Section label="회의 내용" head={["내용", "이슈/비고"]} rows={pad(minute.contents, 4, BLANK_ENTRY).map((row) => [row.content, row.remark])} />
    <Section label="결정사항" head={["내용", "진행 예정 일정"]} rows={pad(minute.decisions, 2, BLANK_ENTRY).map((row) => [row.content, row.plannedSchedule])} />
    <Section label="Action Item" head={["Action Item", "내용", "담당자", "Due Date"]} rows={pad(minute.actionItems, 3, { title: "", content: "", assigneeId: null, assigneeName: "", dueDate: "" }).map((item) => [item.title, item.content, item.assigneeName, dot(item.dueDate)])} />
    <Section label="특이 사항" head={["내용"]} rows={pad(minute.notes, 2, BLANK_ENTRY).map((row) => [row.content])} />
  </article>;
}

function Section({ label, head, rows }: { label: string; head: string[]; rows: string[][] }) {
  return <table className={`minute-doc-section cols-${head.length}`}><tbody>
    <tr><th rowSpan={rows.length + 1} className="minute-doc-label">{label}</th>{head.map((h) => <th key={h}>{h}</th>)}</tr>
    {rows.map((cells, index) => <tr key={index}>{cells.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}
  </tbody></table>;
}

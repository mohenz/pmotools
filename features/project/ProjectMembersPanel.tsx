"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WarningDialog } from "@/components/WarningDialog";

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "슈퍼관리자", ADMIN: "관리자", OPERATOR: "운영자", MEMBER: "일반" };
type Member = { userId: string; loginId: string; name: string; jobTitle: string | null; role: string; status: string };
type Candidate = { userId: string; loginId: string; name: string; role: string };

// 프로젝트별 사용자 배정 — 사용자 관리의 사용자별 배정과 같은 데이터를 프로젝트 기준으로 다룬다.
export function ProjectMembersPanel({ projectId, members, candidates }: { projectId: string; members: Member[]; candidates: Candidate[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(""), [message, setMessage] = useState(""), [selected, setSelected] = useState("");

  async function assign(userId: string, assigned: boolean) {
    setPending(userId); setMessage("");
    const response = await fetch(`/api/v1/admin/projects/${projectId}/members`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, assigned }) });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "배정을 저장하지 못했습니다."); return; }
    setSelected(""); router.refresh();
  }

  return <section className="panel">
    <div className="panel-head"><div><h2>배정된 사용자</h2><p className="group-description">운영자·일반은 배정된 프로젝트에만 접근합니다. 슈퍼관리자·관리자는 배정 없이도 모든 프로젝트에 접근하며, 담당자·참석자 목록에 나오려면 배정합니다.</p></div><span>{members.length}명</span></div>
    <WarningDialog message={message} onClose={() => setMessage("")} />
    <div className="project-members-add">
      <select value={selected} onChange={(event) => setSelected(event.target.value)} aria-label="배정할 사용자">
        <option value="">배정할 사용자 선택 ({candidates.length}명)</option>
        {candidates.map((user) => <option value={user.userId} key={user.userId}>{user.name} ({user.loginId}) · {ROLE_LABEL[user.role] ?? user.role}</option>)}
      </select>
      <button className="button primary" type="button" disabled={!selected || pending === selected} onClick={() => assign(selected, true)}>배정</button>
    </div>
    <div className="table-wrap"><table className="dense-table">
      <thead><tr><th>이름</th><th>아이디</th><th>직무</th><th>계정 역할</th><th>상태</th><th /></tr></thead>
      <tbody>{members.map((member) => <tr key={member.userId}>
        <td>{member.name}</td><td className="mono">{member.loginId}</td><td>{member.jobTitle ?? "-"}</td><td>{ROLE_LABEL[member.role] ?? member.role}</td>
        <td>{member.status === "LOCKED" ? <span className="badge issue">잠김</span> : "정상"}</td>
        <td><button className="button secondary" type="button" disabled={pending === member.userId} onClick={() => assign(member.userId, false)}>배정 해제</button></td>
      </tr>)}</tbody>
    </table>{!members.length && <p className="empty">배정된 사용자가 없습니다.</p>}</div>
  </section>;
}

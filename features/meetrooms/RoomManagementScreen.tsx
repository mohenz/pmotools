"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Room = { id: string; name: string; roomType: "LARGE" | "SMALL"; capacity: number; floor: string | null; equipment: string[]; isActive: boolean; deletedAt: string | null };
const api = async (url: string, init?: RequestInit) => { const response = await fetch(url, init), body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error?.message ?? "요청을 처리하지 못했습니다."); return body.data; };

export function RoomManagementScreen({ initialRooms }: { initialRooms: Room[] }) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", roomType: "SMALL" as "LARGE" | "SMALL", capacity: 6, floor: "", equipment: "", isActive: true });

  async function refresh() { setRooms(await api("/api/v1/meeting-rooms?archived=1")); router.refresh(); }
  async function create(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); try { await api("/api/v1/meeting-rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: f.get("name"), roomType: f.get("roomType"), capacity: Number(f.get("capacity")), floor: f.get("floor") || null, equipment: String(f.get("equipment") || "").split(",").map((x) => x.trim()).filter(Boolean) }) }); form.reset(); await refresh(); setMessage("회의실을 추가했습니다."); } catch (err) { setMessage((err as Error).message); } }
  async function remove(r: Room) { if (!confirm(`${r.name}을 삭제하시겠습니까?`)) return; try { const result = await api(`/api/v1/meeting-rooms/${r.id}`, { method: "DELETE" }); await refresh(); setMessage(result.mode === "archived" ? "보관 처리했습니다." : "삭제했습니다."); } catch (err) { setMessage((err as Error).message); } }
  async function restore(id: string) { await api(`/api/v1/meeting-rooms/${id}/restore`, { method: "POST" }); await refresh(); }
  function startEdit(r: Room) { setEditingId(r.id); setDraft({ name: r.name, roomType: r.roomType, capacity: r.capacity, floor: r.floor ?? "", equipment: r.equipment.join(", "), isActive: r.isActive }); }
  async function saveEdit(e: FormEvent<HTMLFormElement>, id: string) { e.preventDefault(); try { await api(`/api/v1/meeting-rooms/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: draft.name, roomType: draft.roomType, capacity: draft.capacity, floor: draft.floor || null, equipment: draft.equipment.split(",").map((x) => x.trim()).filter(Boolean), isActive: draft.isActive }) }); setEditingId(null); await refresh(); setMessage("회의실 정보를 저장했습니다."); } catch (err) { setMessage((err as Error).message); } }

  return <>
    <header className="topbar"><div><h1>회의실 관리</h1><p>예약에 사용할 회의실을 등록하고 관리합니다.</p></div></header>
    <div className="content settings-content">
      {message && <p className="action-message" role="status">{message}</p>}
      <div className="meeting-split">
        <form className="panel meeting-form" onSubmit={create}>
          <h2>회의실 추가</h2>
          <label>이름<input name="name" required /></label>
          <div className="form-grid two"><label>유형<select name="roomType"><option value="SMALL">소회의실</option><option value="LARGE">대회의실</option></select></label><label>인원<input name="capacity" type="number" min="1" defaultValue="6" /></label></div>
          <label>위치<input name="floor" /></label>
          <label>장비<input name="equipment" /></label>
          <button className="button primary">추가</button>
        </form>
        <section className="panel"><div className="meeting-list">{rooms.map((r) => editingId === r.id ?
          <form className="panel compact meeting-form" onSubmit={(e) => saveEdit(e, r.id)} key={r.id}>
            <label>이름<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></label>
            <div className="form-grid two"><label>유형<select value={draft.roomType} onChange={(e) => setDraft({ ...draft, roomType: e.target.value as "LARGE" | "SMALL" })}><option value="SMALL">소회의실</option><option value="LARGE">대회의실</option></select></label><label>인원<input type="number" min="1" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })} /></label></div>
            <label>위치<input value={draft.floor} onChange={(e) => setDraft({ ...draft, floor: e.target.value })} /></label>
            <label>장비<input value={draft.equipment} onChange={(e) => setDraft({ ...draft, equipment: e.target.value })} /></label>
            <label className="toggle"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> 사용 가능</label>
            <div className="topbar-actions"><button className="button primary" type="submit">저장</button><button className="button secondary" type="button" onClick={() => setEditingId(null)}>취소</button></div>
          </form>
          : <article className={r.deletedAt ? "archived" : ""} key={r.id}><div><strong>{r.name}</strong><p>{r.roomType === "LARGE" ? "대회의실" : "소회의실"} · {r.capacity}명 · {r.floor ?? "-"}{!r.isActive && !r.deletedAt ? " · 사용중지" : ""}</p></div><div className="topbar-actions">{!r.deletedAt && <button className="button secondary" onClick={() => startEdit(r)}>수정</button>}{r.deletedAt ? <button className="button secondary" onClick={() => restore(r.id)}>복원</button> : <button className="button danger" onClick={() => remove(r)}>삭제</button>}</div></article>
        )}</div></section>
      </div>
    </div>
  </>;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MenuPreferenceRow } from "@/lib/domain/menu-preferences";

const ROLE_FIELDS = [
  { field: "visibleAdmin", label: "관리자" },
  { field: "visibleOperator", label: "운영자" },
  { field: "visibleMember", label: "사용자" },
] as const;

export function MenuPreferencesScreen({ initial }: { initial: MenuPreferenceRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function toggleRole(key: string, field: (typeof ROLE_FIELDS)[number]["field"]) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, [field]: !item[field] } : item)));
  }
  function rename(key: string, label: string) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, label } : item)));
  }
  function move(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function save() {
    setPending(true); setMessage(null);
    const body = items.map((item, index) => ({ key: item.key, label: item.label.trim(), visibleAdmin: item.visibleAdmin, visibleOperator: item.visibleOperator, visibleMember: item.visibleMember, sortOrder: index }));
    const response = await fetch("/api/v1/settings/menu-preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) { setMessage({ type: "error", text: payload?.error?.message ?? "저장하지 못했습니다." }); return; }
    if (Array.isArray(payload?.data)) setItems(payload.data);
    setMessage({ type: "success", text: "저장되었습니다." });
    router.refresh();
  }

  return <>
    <header className="topbar"><div><h1>메뉴 설정</h1><p>메뉴명과 역할별 노출 여부, 왼쪽 사이드바의 순서를 조정합니다.</p></div></header>
    <div className="content settings-content">
      {message && <p className={message.type === "error" ? "form-error action-message" : "form-success action-message"} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
      <section className="panel">
        <div className="panel-head"><h2>메뉴 목록</h2><span>{items.length}개</span></div>
        <div className="meeting-list">
          {items.map((item, index) => <article key={item.key}>
            <label className="menu-name-field">
              <span className="sr-only">{item.key} 메뉴명</span>
              <input className="input" type="text" value={item.label} maxLength={40} onChange={(event) => rename(item.key, event.target.value)} aria-label={`${item.key} 메뉴명`} />
            </label>
            <div className="topbar-actions">
              {ROLE_FIELDS.map(({ field, label }) => <label className="toggle" key={field}><input type="checkbox" checked={item[field]} onChange={() => toggleRole(item.key, field)} /> {label}</label>)}
              <button className="button secondary" type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`${item.label} 위로`}>↑</button>
              <button className="button secondary" type="button" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label={`${item.label} 아래로`}>↓</button>
            </div>
          </article>)}
        </div>
        <button className="button primary" type="button" disabled={pending} onClick={save} style={{ marginTop: 12 }}>{pending ? "저장 중…" : "저장"}</button>
      </section>
    </div>
  </>;
}

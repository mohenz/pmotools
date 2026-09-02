"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PortfolioPanelRow } from "@/lib/domain/portfolio-panels";

export function PortfolioPanelPreferencesScreen({ initial }: { initial: PortfolioPanelRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function toggle(key: string) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, visible: !item.visible } : item)));
  }
  async function save() {
    setPending(true); setMessage(null);
    const body = items.map((item) => ({ key: item.key, visible: item.visible }));
    const response = await fetch("/api/v1/settings/portfolio-panels", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) { setMessage({ type: "error", text: payload?.error?.message ?? "저장하지 못했습니다." }); return; }
    if (Array.isArray(payload?.data)) setItems(payload.data);
    setMessage({ type: "success", text: "저장되었습니다." });
    router.refresh();
  }

  return <>
    <header className="topbar"><div><h1>포트폴리오 패널 설정</h1><p>통합 현황(포트폴리오) 화면에 노출할 패널을 선택합니다.</p></div></header>
    <div className="content settings-content">
      {message && <p className={message.type === "error" ? "form-error action-message" : "form-success action-message"} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
      <section className="panel">
        <div className="panel-head"><h2>패널 목록</h2><span>{items.length}개</span></div>
        <div className="meeting-list">
          {items.map((item) => <article key={item.key}>
            <span>{item.label}</span>
            <div className="topbar-actions">
              <label className="toggle"><input type="checkbox" checked={item.visible} onChange={() => toggle(item.key)} /> 표시</label>
            </div>
          </article>)}
        </div>
        <button className="button primary" type="button" disabled={pending} onClick={save} style={{ marginTop: 12 }}>{pending ? "저장 중…" : "저장"}</button>
      </section>
    </div>
  </>;
}

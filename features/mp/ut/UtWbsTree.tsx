"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { UtTreeNode } from "@/lib/server/mp/ut/grid";

// 설계서 8장 — 모든 목록 화면 좌측에 고정하는 WBS 트리. 노드를 고르면 ?wbs={id}로 해당 WBS 하위만 조회한다.
export function UtWbsTree({ nodes }: { nodes: UtTreeNode[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const selected = search.get("wbs") ?? "";
  const [q, setQ] = useState("");
  const [onlyWithScenario, setOnlyWithScenario] = useState(false);
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, UtTreeNode[]>();
    for (const n of nodes) map.set(n.parentId, [...(map.get(n.parentId) ?? []), n]);
    return map;
  }, [nodes]);
  const ancestorsOfSelected = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const set = new Set<string>();
    let cur = byId.get(selected);
    while (cur?.parentId) { set.add(cur.parentId); cur = byId.get(cur.parentId); }
    return set;
  }, [nodes, selected]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(nodes.filter((n) => n.level === 1).map((n) => n.id)));
  const keyword = q.trim().toLowerCase();
  const matches = (n: UtTreeNode) => `${n.displayId} ${n.code} ${n.name}`.toLowerCase().includes(keyword);

  function go(id: string) {
    const params = new URLSearchParams(search.toString());
    if (id) params.set("wbs", id); else params.delete("wbs");
    params.delete("page");
    router.push(`${pathname}${params.toString() ? `?${params}` : ""}`);
  }

  const render = (parentId: string | null, depth: number): React.ReactNode => (childrenOf.get(parentId) ?? [])
    .filter((n) => !onlyWithScenario || n.scenarioCount > 0)
    .map((n) => {
      const kids = childrenOf.get(n.id) ?? [];
      const expanded = keyword ? true : open.has(n.id) || ancestorsOfSelected.has(n.id);
      const sub = kids.length && expanded ? render(n.id, depth + 1) : null;
      if (keyword && !matches(n) && !(Array.isArray(sub) && sub.some(Boolean))) return null;
      return <li key={n.id}>
        <div className={`ut-tree-row${selected === n.id ? " active" : ""}`} style={{ paddingLeft: depth * 12 }}>
          {kids.length ? <button type="button" className="ut-tree-fold" aria-label={expanded ? "접기" : "펼치기"} onClick={() => setOpen((s) => { const x = new Set(s); if (x.has(n.id)) x.delete(n.id); else x.add(n.id); return x; })}>{expanded ? "▾" : "▸"}</button> : <span className="ut-tree-fold" />}
          <button type="button" className="ut-tree-label" title={`${n.displayId} ${n.code}`} onClick={() => go(n.id)}><span className="mono">{n.code}</span> {n.name}</button>
          {n.scenarioCount > 0 && <span className="ut-tree-count">{n.caseCount}</span>}
        </div>
        {sub && <ul>{sub}</ul>}
      </li>;
    });

  return <aside className="panel ut-tree" aria-label="WBS 트리">
    <div className="ut-tree-head">
      <strong>WBS</strong>
      <button type="button" className={`ut-tree-all${selected ? "" : " active"}`} onClick={() => go("")}>전체</button>
    </div>
    <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="WBS 코드·명 검색" aria-label="WBS 검색" />
    <label className="ut-tree-only"><input type="checkbox" checked={onlyWithScenario} onChange={(e) => setOnlyWithScenario(e.target.checked)} />시나리오 있는 WBS만</label>
    <ul className="ut-tree-list">{render(null, 0)}</ul>
  </aside>;
}

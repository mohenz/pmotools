"use client";

import { useEffect, useState } from "react";

type TaskSummary = { id: string; displayId: string; name: string };

export function TaskLinkPicker({ excludeId, relation, onPick }: { excludeId: string; relation: "predecessor" | "successor"; onPick: (task: TaskSummary) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TaskSummary[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/v1/management-tasks/search?q=${encodeURIComponent(q)}&excludeId=${encodeURIComponent(excludeId)}`);
      if (!response.ok) return;
      const payload = await response.json().catch(() => null);
      setResults(payload?.data ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, excludeId]);

  function pick(task: TaskSummary) {
    onPick(task);
    setQuery("");
    setResults([]);
  }

  return <div className="attendee-search">
    <input type="text" placeholder="ID 또는 이름으로 검색" value={query} onChange={(e) => setQuery(e.target.value)} aria-label={relation === "predecessor" ? "선행 항목 검색" : "후행 항목 검색"} />
    {results.length > 0 && <ul className="attendee-suggestions">{results.map((task) => <li key={task.id}><button type="button" onClick={() => pick(task)}>{task.displayId} <small>({task.name})</small></button></li>)}</ul>}
  </div>;
}

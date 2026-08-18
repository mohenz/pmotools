"use client";

import { useState } from "react";
import Link from "next/link";
import { BAND_LABEL } from "@/lib/domain/management-tasks";
import type { ManagementTaskRow } from "@/lib/server/management-tasks";
import { ManagementTaskTable } from "@/screens/ManagementTaskDashboardScreen";

export function ManagementTaskDashboardView({ tasks }: { tasks: ManagementTaskRow[] }) {
  const [view, setView] = useState<"card" | "list">("card");
  return <>
    <div className="view-toggle" role="group" aria-label="보기 방식">
      <button type="button" className={view === "card" ? "selected" : ""} onClick={() => setView("card")}>카드형</button>
      <button type="button" className={view === "list" ? "selected" : ""} onClick={() => setView("list")}>목록형</button>
    </div>
    {view === "card" ? <div className="task-card-grid">
      {tasks.map((task) => <Link className={`task-card band-${task.band}`} href={`/management-tasks/${task.id}`} key={task.id}>
        <div><span className="mono">{task.displayId}</span><span className={`badge band-${task.band}`}>{BAND_LABEL[task.band]}</span></div>
        <strong>{task.name}</strong>
        <small>{task.groupLabel} · {task.registrationDate}</small>
        <div className="task-score-panel"><strong>{task.totalScore}</strong></div>
      </Link>)}
    </div> : <ManagementTaskTable tasks={tasks} />}
  </>;
}

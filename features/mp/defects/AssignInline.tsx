"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { defectApi, json } from "@/features/mp/defects/client";
import { AssigneePicker, type AssigneeOption } from "@/features/mp/defects/AssigneePicker";

// 목록 안에서 담당자를 바로 지정한다. 버전은 서버에서 최신 값을 읽어 와 충돌 검사를 유지한다.
export function AssignInline({ defectId, members }: { defectId: string; members: AssigneeOption[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [state, setState] = useState<{ pending: boolean; error: string | null }>({ pending: false, error: null });

  async function assign() {
    if (!value) return;
    setState({ pending: true, error: null });
    try {
      const d = await defectApi<{ version: number }>(`items/${defectId}`);
      await defectApi(`items/${defectId}/assign`, json("POST", { assigneeUserId: value, version: d.version }));
      router.refresh();
      setState({ pending: false, error: null });
    } catch (e) { setState({ pending: false, error: e instanceof Error ? e.message : "지정하지 못했습니다." }); }
  }

  // 팝업에서 고르면 입력창에만 반영하고, "지정"을 눌러야 저장한다.
  return <span className="defect-inline">
    <AssigneePicker members={members} value={value} onChange={setValue} disabled={state.pending} />
    <button type="button" className="button secondary defect-icon-button" aria-label="저장" title={state.pending ? "저장 중…" : "저장"} disabled={!value || state.pending} onClick={() => void assign()}><Save aria-hidden="true" /></button>
    {state.error && <span className="ut-hint" role="alert">{state.error}</span>}
  </span>;
}

"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { getDefectCodes } from "@/lib/server/mp/defects/common";
import type { getCaseEntry } from "@/lib/server/mp/defects/lookup";
import { defectApi } from "@/features/mp/defects/client";
import { AssigneePicker, type AssigneeOption } from "@/features/mp/defects/AssigneePicker";
import { UtEvidencePicker } from "@/features/mp/ut/UtEvidencePicker";

type Codes = Awaited<ReturnType<typeof getDefectCodes>>;
type CaseEntry = Awaited<ReturnType<typeof getCaseEntry>>;
type Collected = { pageUrl?: string; pageTitle?: string; userAgent?: string; screenshot?: string; testStage?: string; caseId?: string; title?: string; menuName?: string; screenName?: string; source?: "WIDGET" | "EXTENSION" };

const MAX_FILES = 3;
const MAX_MB = 20;
const STORE_KEY = "pmo-defect-collected"; // 위젯·확장이 보낸 수집 데이터 — 로그인 이동 중에도 유지하고 등록·취소하면 지운다

function dataUrlToFile(dataUrl: string, name: string) {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const file = new File([bytes], `${name}.${m[1] === "image/jpeg" ? "jpg" : m[1].slice(6)}`, { type: m[1] });
  return file.size <= MAX_MB * 1024 * 1024 ? file : null;
}

// DM-02 — 수동 등록 · 케이스 진입 · 위젯/확장 진입. 화면경로는 필수가 아니며 직접 입력과 목록 선택, 수집 URL 자동 제안을 모두 지원한다.
export function DefectForm({ codes, screens, allowedOrigins, members, canAssign, popup, initial }: {
  codes: Codes; screens: { path: string; name: string }[]; allowedOrigins: string[]; members: AssigneeOption[]; canAssign: boolean; popup: boolean;
  initial: { caseEntry: CaseEntry | null; stageId: string; title: string };
}) {
  const router = useRouter();
  const [caseEntry, setCaseEntry] = useState<CaseEntry | null>(initial.caseEntry);
  const [caseQuery, setCaseQuery] = useState("");
  const [caseHits, setCaseHits] = useState<CaseEntry[]>([]);
  const [screenUrl, setScreenUrl] = useState(initial.caseEntry?.screenUrl ?? "");
  const [screenPath, setScreenPath] = useState("");
  const [screenName, setScreenName] = useState(initial.caseEntry?.screenName ?? "");
  const [title, setTitle] = useState(initial.title);
  const [menuName, setMenuName] = useState("");
  const [envInfo, setEnvInfo] = useState("");
  const [suggest, setSuggest] = useState<{ path: string; name: string } | null>(null);
  const [stageId, setStageId] = useState(initial.stageId || codes.stages.find((s) => s.code === "UNIT")?.id || codes.stages[0]?.id || "");
  const [assigneeId, setAssigneeId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [meta, setMeta] = useState<Collected | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [captureNote, setCaptureNote] = useState("");
  const form = useRef<HTMLFormElement>(null);
  // 첨부한 이미지(캡처·붙여넣기)를 바로 확인할 수 있게 미리보기 주소를 만든다. 바뀌거나 닫히면 해제한다.
  const previews = useMemo(() => files.filter((f) => f.type.startsWith("image/")).map((f) => ({ name: f.name, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);
  const defaultSeverity = codes.severities.find((s) => s.code === "MAJOR")?.id ?? codes.severities[0]?.id ?? "";

  // 수집 단계 이름은 "통합테스트"처럼 코드·이름과 조금 달라도 맞춘다(정확히 같은 것 → 포함 관계 순).
  function matchStage(name: string) {
    const n = name.trim().toLowerCase();
    return codes.stages.find((x) => x.code.toLowerCase() === n || x.label.toLowerCase() === n)
      ?? codes.stages.find((x) => n.includes(x.label.toLowerCase()) || x.label.toLowerCase().includes(n));
  }

  // 사용자가 이미 입력한 값은 덮어쓰지 않는다. 같은 데이터가 다시 오면(로그인 이동·READY 재응답) 캡처는 한 장만 유지한다.
  function applyCollected(d: Collected, live = false) {
    setMeta(d);
    if (d.pageUrl && /^https?:\/\//i.test(d.pageUrl)) setScreenUrl(d.pageUrl);
    setTitle((v) => v || (d.title ?? d.pageTitle ?? "").slice(0, 255));
    setMenuName((v) => v || (d.menuName ?? "").slice(0, 255));
    setScreenName((v) => v || (d.screenName ?? "").slice(0, 255));
    setEnvInfo((v) => v || (d.userAgent ?? "").slice(0, 255));
    if (d.testStage) { const s = matchStage(d.testStage); if (s) setStageId(s.id); }
    if (d.screenshot) {
      const f = dataUrlToFile(d.screenshot, "capture");
      if (f) { setCaptureNote(""); setFiles((prev) => [...prev.filter((x) => !x.name.startsWith("capture.")), f].slice(0, MAX_FILES)); }
      else setCaptureNote(`수집된 캡처를 첨부하지 못했습니다(PNG·JPEG·WEBP, ${MAX_MB}MB 이하만 가능). 직접 붙여넣거나 파일로 올려 주세요.`);
    } else if (live) setCaptureNote("화면 캡처가 전달되지 않았습니다. 필요하면 직접 붙여넣거나 파일로 올려 주세요.");
    if (d.caseId) void defectApi<CaseEntry>(`lookup/cases/${d.caseId}`).then((c) => { setCaseEntry(c); setScreenName((v) => v || c.screenName); setScreenUrl((v) => v || c.screenUrl); }).catch(() => undefined);
  }

  // 위젯·확장 프로그램 메시지 — 대상 도메인 관리에 등록된 활성 출처의 메시지만 받는다.
  useEffect(() => {
    try { const saved = sessionStorage.getItem(STORE_KEY); if (saved) applyCollected(JSON.parse(saved) as Collected); } catch { /* 저장소를 쓸 수 없으면 무시 */ }
    if (!popup) return;
    const ownOrigin = window.location.origin;
    const onMessage = (event: MessageEvent) => {
      // 위젯: 대상 도메인 관리에 등록된 활성 출처의 창에서 온 메시지만. 확장 프로그램: 등록 창 안에서 주입한 메시지이므로 수집한 페이지 주소가 등록된 출처인지 확인한다.
      const d = event.data as { type?: string; payload?: unknown } | null;
      if (!d || d.type !== "PMO_DEFECT_DATA" || typeof d.payload !== "object" || d.payload === null) return;
      const trusted = (origin: string) => origin === ownOrigin || allowedOrigins.includes(origin); // PMOTOOLS 자신(테스트 벤치 포함)과 등록된 대상 도메인
      const fromWidget = event.source === window.opener && trusted(event.origin);
      const fromExtension = event.origin === ownOrigin && event.source === window;
      if (!fromWidget && !fromExtension) {
        if (event.source === window.opener) setMessage({ tone: "error", text: `${event.origin}는 대상 도메인으로 등록되어 있지 않아 수집한 화면 정보와 캡처를 받지 못했습니다. 결함관리 > 설정 > 대상 도메인에 등록해 주세요.` });
        return;
      }
      const p = d.payload as Record<string, unknown>;
      const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : undefined);
      const src = p.source === "EXTENSION" || p.source === "WIDGET" ? p.source : fromExtension ? "EXTENSION" : "WIDGET";
      const data: Collected = { pageUrl: str(p.pageUrl, 2000), pageTitle: str(p.pageTitle, 500), userAgent: str(p.userAgent, 1000), screenshot: str(p.screenshot, 30_000_000), testStage: str(p.testStage, 50), caseId: str(p.caseId, 64), title: str(p.title, 255), menuName: str(p.menuName, 255), screenName: str(p.screenName, 255), source: src };
      if (fromExtension) {
        let pageOrigin = "";
        try { pageOrigin = data.pageUrl ? new URL(data.pageUrl).origin : ""; } catch { /* 형식 오류는 아래에서 거절 */ }
        if (!trusted(pageOrigin)) { setMessage({ tone: "error", text: `${pageOrigin || "알 수 없는 사이트"}는 대상 도메인으로 등록되어 있지 않습니다. 결함관리 > 설정 > 대상 도메인에 등록해 주세요.` }); return; }
      }
      try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ ...data, screenshot: undefined })); } catch { /* 무시 */ }
      applyCollected(data, true);
    };
    window.addEventListener("message", onMessage);
    window.opener?.postMessage({ type: "PMO_DEFECT_READY" }, "*"); // 위젯이 연 창
    window.postMessage({ type: "PMO_DEFECT_READY" }, ownOrigin); // 확장 프로그램이 연 창(opener 없음) — 주입된 스크립트가 듣는다
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup, allowedOrigins]);

  // 수집 URL → 화면경로 제안(사용자가 이미 입력한 경로는 덮어쓰지 않는다)
  useEffect(() => {
    if (!screenUrl || !/^https?:\/\//i.test(screenUrl)) { setSuggest(null); return; }
    const t = setTimeout(() => { void defectApi<{ path: string; name: string } | null>(`screens/match?url=${encodeURIComponent(screenUrl)}`).then(setSuggest).catch(() => setSuggest(null)); }, 300);
    return () => clearTimeout(t);
  }, [screenUrl]);

  useEffect(() => {
    if (caseQuery.trim().length < 2) { setCaseHits([]); return; }
    const t = setTimeout(() => { void defectApi<CaseEntry[]>(`lookup/cases?q=${encodeURIComponent(caseQuery)}`).then(setCaseHits).catch(() => setCaseHits([])); }, 300);
    return () => clearTimeout(t);
  }, [caseQuery]);

  // 증적 선택은 단위테스트와 같은 선택기(파일 선택 + 클립보드 붙여넣기, 같은 형식·3개)를 쓰고, 파일당 20MB를 추가로 확인한다.
  function changeFiles(next: File[]) {
    const big = next.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (big) { setMessage({ tone: "error", text: `${big.name}: 파일은 ${MAX_MB}MB 이하만 올릴 수 있습니다. 파일을 줄이거나 다른 파일을 선택해 주세요.` }); return; }
    setMessage(null); setFiles(next);
  }

  function close() {
    try { sessionStorage.removeItem(STORE_KEY); } catch { /* 무시 */ }
    if (popup) {
      try { window.opener?.postMessage({ type: "PMO_DEFECT_CLOSE" }, "*"); } catch { /* 무시 */ }
      window.postMessage({ type: "PMO_DEFECT_CLOSE" }, window.location.origin); // 확장 프로그램이 연 창은 확장이 닫는다
      window.close();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "");
    const payload = {
      title: text("title"), stepsToRepro: text("stepsToRepro"), testStageCodeId: stageId, severityCodeId: text("severityCodeId"), priorityCodeId: text("priorityCodeId") || null,
      screenPath, menuName: text("menuName"), screenName, screenUrl, envInfo: text("envInfo"),
      caseId: caseEntry?.id ?? null, wbsItemId: caseEntry?.wbsItemId ?? null, groupId: caseEntry?.groupId ?? null, requirementId: caseEntry?.requirementId ?? null,
      assigneeUserId: canAssign ? text("assigneeUserId") || null : null,
      sourceType: meta ? (meta.source ?? (popup ? "WIDGET" : "MANUAL")) : caseEntry ? "ENTRY" : "MANUAL",
      sourceMeta: meta ? { pageUrl: meta.pageUrl, pageTitle: meta.pageTitle, userAgent: meta.userAgent } : undefined,
    };
    const body = new FormData();
    body.set("payload", JSON.stringify(payload));
    files.forEach((file) => body.append("files", file));
    setPending(true); setMessage(null);
    defectApi<{ id: string; displayId: string; evidenceError: string | null }>("items", { method: "POST", body })
      .then((r) => {
        close();
        if (popup) return;
        router.push(`/mp-defects/${r.id}${r.evidenceError ? "?notice=evidence" : ""}`);
      })
      .catch((e: Error) => setMessage({ tone: "error", text: e.message }))
      .finally(() => setPending(false));
  }

  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (message?.tone === "error") messageRef.current?.focus(); }, [message]); // 실패 시 오류 안내로 포커스 이동

  return <form ref={form} className="panel form-panel" onSubmit={submit}>
    {message && <p ref={messageRef} tabIndex={-1} className={`action-message ${message.tone === "ok" ? "ut-ok" : ""}`} role={message.tone === "error" ? "alert" : "status"} aria-live="polite">{message.text}</p>}
    <fieldset disabled={pending} className="ut-fieldset">
      <h2 className="ut-section">기본 정보</h2>
      <div className="form-grid">
        <label className="span-2">제목 *<input name="title" required minLength={5} maxLength={255} autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="5자 이상, 예: 주문 저장 시 중복 등록됨" /></label>
        <label>테스트 단계 *<select name="testStageCodeId" value={stageId} onChange={(e) => setStageId(e.target.value)} required>{codes.stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label>심각도 *<select name="severityCodeId" defaultValue={defaultSeverity} required>{codes.severities.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label>우선순위<select name="priorityCodeId" defaultValue=""><option value="">선택 안 함</option>{codes.priorities.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        {canAssign && <div className="ut-field"><span>조치자</span><AssigneePicker members={members} value={assigneeId} onChange={setAssigneeId} name="assigneeUserId" /><small className="ut-hint">선택하지 않으면 연결된 WBS Task의 작업자가 기본값입니다.</small></div>}
        <label className="span-2">재현 단계<textarea name="stepsToRepro" rows={5} placeholder="재현 순서, 기대 결과와 실제 결과를 적어 주세요." /></label>
      </div>

      <h2 className="ut-section">화면 정보</h2>
      <div className="form-grid">
        <label className="span-2">화면 URL<input name="screenUrl" type="url" inputMode="url" autoComplete="off" value={screenUrl} onChange={(e) => setScreenUrl(e.target.value)} maxLength={1000} placeholder="http:// 또는 https:// 로 시작하는 주소" /></label>
        <label>화면경로<input name="screenPath" list="defect-screen-paths" autoComplete="off" value={screenPath} onChange={(e) => setScreenPath(e.target.value)} maxLength={500} placeholder="직접 입력하거나 목록에서 선택(필수 아님)" />
          <datalist id="defect-screen-paths">{screens.map((s) => <option key={s.path} value={s.path}>{s.name}</option>)}</datalist></label>
        <label>화면명<input name="screenName" autoComplete="off" value={screenName} onChange={(e) => setScreenName(e.target.value)} maxLength={255} /></label>
        {suggest && !screenPath && <p className="span-2 ut-hint" role="status">수집된 URL과 맞는 화면경로: <strong>{suggest.path}</strong>{" "}<button type="button" className="button secondary sm" onClick={() => { setScreenPath(suggest.path); if (!screenName) setScreenName(suggest.name); }}>화면경로 적용</button></p>}
        <label>메뉴명<input name="menuName" autoComplete="off" maxLength={255} value={menuName} onChange={(e) => setMenuName(e.target.value)} /></label>
        <label>환경<input name="envInfo" autoComplete="off" maxLength={255} value={envInfo} onChange={(e) => setEnvInfo(e.target.value)} placeholder="브라우저, OS, 서버 환경" /></label>
      </div>

      <h2 className="ut-section">연결 정보(선택)</h2>
      {caseEntry ? <p>케이스 <strong className="mono">{caseEntry.displayId}</strong> {caseEntry.name} · 업무단위 {caseEntry.groupLabel}{caseEntry.wbsName ? ` · Task ${caseEntry.wbsName}` : ""}{caseEntry.workerName ? ` · 작업자 ${caseEntry.workerName}` : ""}{" "}<button type="button" className="button secondary sm" onClick={() => setCaseEntry(null)}>연결 해제</button></p>
        : <div><label>단위테스트 케이스 검색<input name="caseQuery" type="search" autoComplete="off" value={caseQuery} onChange={(e) => setCaseQuery(e.target.value)} placeholder="케이스 ID·명·화면 이름(2자 이상)" /></label>
          {caseHits.length > 0 && <ul className="defect-hit-list" aria-label="검색된 케이스">{caseHits.map((c) => <li key={c.id}><button type="button" onClick={() => { setCaseEntry(c); setCaseHits([]); setCaseQuery(""); if (!screenUrl) setScreenUrl(c.screenUrl); if (!screenName) setScreenName(c.screenName); }}>{c.displayId} · {c.name}</button></li>)}</ul>}
          <p className="ut-hint">연결하지 않으면 독립 결함으로 등록됩니다. 담당자는 연결된 Task의 작업자가 기본값입니다.</p></div>}

      <h2 className="ut-section">증적</h2>
      <UtEvidencePicker files={files} onChange={changeFiles} disabled={pending} />
      {captureNote && <p className="ut-hint" role="status">{captureNote}</p>}
      {previews.length > 0 && <div aria-label="증적 이미지 미리보기" style={{ display: "grid", gap: 12, marginTop: 8 }}>
        {previews.map((p) => <figure key={p.url} style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt={`증적 미리보기: ${p.name}`} style={{ maxWidth: "100%", maxHeight: 360, border: "1px solid #cbd5e1", borderRadius: 6, background: "#f8fafc" }} />
          <figcaption className="ut-hint">{p.name}</figcaption>
        </figure>)}
      </div>}
      <p className="ut-hint">결함당 최대 {MAX_FILES}개, 파일당 {MAX_MB}MB까지 올릴 수 있습니다.</p>
    </fieldset>
    <div className="form-actions">
      <button className="button primary" type="submit" disabled={pending}>{pending ? "등록 중…" : "결함 등록"}</button>
      <button className="button secondary" type="button" disabled={pending} onClick={() => (popup ? close() : router.push("/mp-defects"))}>취소</button>
    </div>
  </form>;
}

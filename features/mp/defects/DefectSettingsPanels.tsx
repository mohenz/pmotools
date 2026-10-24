"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { getDefectSettings } from "@/lib/server/mp/defects/settings";
import type { ScreenEntry } from "@/lib/domain/defect-screens";
import { defectApi, json } from "@/features/mp/defects/client";

type Settings = Awaited<ReturnType<typeof getDefectSettings>>;
type Preview = { total: number; insertCount: number; updateCount: number; errorCount: number; rows: { rowNumber: number; path: string; url: string | null; name: string; isActive: boolean; action: string }[]; errors: { rowNumber: number; field: string; message: string }[] };

export function DefectSettingsPanels({ tab, settings, screens, q }: { tab: "codes" | "sites" | "screens" | "bench"; settings: Settings; screens: ScreenEntry[]; q: string }) {
  const router = useRouter();
  const canManage = settings.canManage;
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", origin: "", isActive: true });

  function run(path: string, init: RequestInit, done: string) {
    setPending(true); setMessage(null);
    return defectApi(path, init).then(() => { setMessage({ tone: "ok", text: done }); router.refresh(); return true; }).catch((e: Error) => { setMessage({ tone: "error", text: e.message }); return false; }).finally(() => setPending(false));
  }

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const msg = message && <p className={message.tone === "ok" ? "form-message" : "action-message"} role="status">{message.text}</p>;

  if (tab === "bench") {
    const links = [["PC 테스트 벤치 (ZeroStore)", "/test_view/test_view.html"], ["모바일 테스트 베드", "/test_view/mobile_test_bed.html"]] as const;
    const snippet = `<script src="${origin}/defect-widget/pmo-defect-widget.js" data-pmotools-url="${origin}" defer></script>`;
    return <>
      <section className="panel"><div className="panel-head"><h2>테스트 벤치 접속 경로</h2><span>결함 신고(위젯·캡처) 연동을 시험하는 샘플 사이트입니다. 새 창에서 열립니다.</span></div>
        <div className="table-wrap"><table className="ut-table"><thead><tr><th>이름</th><th>주소</th></tr></thead><tbody>
          {links.map(([name, path]) => <tr key={path}><td>{name}</td><td><a href={path} target="_blank" rel="noopener noreferrer">{origin}{path}</a></td></tr>)}
        </tbody></table></div>
        <p className="ut-hint">로그인 없이 열 수 있는 샘플 페이지이며, 신고 버튼을 누르면 로그인된 결함 등록 팝업이 열립니다.</p>
      </section>
      <section className="panel"><div className="panel-head"><h2>테스트 대상 사이트에 위젯 넣기</h2><span>대상 사이트 주소는 &quot;대상 도메인&quot;에 등록되어 있어야 합니다.</span></div>
        <pre className="mono" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>{snippet}</pre>
        <p className="ut-hint"><a href="/manuals/defect-widget" target="_blank" rel="noopener noreferrer">위젯·확장 프로그램 설치 메뉴얼 보기</a></p>
      </section>
    </>;
  }

  if (tab === "codes") return <>{msg}
    <section className="panel"><div className="panel-head"><h2>미조치 중대 결함 기준</h2><span>체크한 심각도의 미조치 결함을 &quot;미조치 중대 결함&quot;으로 셉니다</span></div>
      <ul>{settings.codes.severities.map((s) => <li key={s.id}><label><input type="checkbox" checked={s.isMajorImpact} disabled={!canManage || pending} onChange={(e) => void run("settings/severity", json("POST", { severityCodeId: s.id, isMajorImpact: e.target.checked }), "중대 기준을 저장했습니다.")} /> {s.label}</label></li>)}</ul></section></>;


  if (tab === "sites") {
    const create = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); void run("settings/sites", json("POST", { name: f.get("name"), origin: f.get("origin"), isActive: true }), "대상 도메인을 추가했습니다.").then((done) => { if (done) form.reset(); }); };
    const saveEdit = (e: FormEvent<HTMLFormElement>, id: string) => { e.preventDefault(); void run("settings/sites", json("POST", { id, name: draft.name, origin: draft.origin, isActive: draft.isActive }), "저장했습니다.").then((done) => { if (done) setEditingId(null); }); };
    return <>{msg}
      <p className="ut-hint">위젯·확장 프로그램은 여기에 등록된 사용 중인 도메인에서만 동작합니다. 삭제는 없고 사용 중지로 바꿉니다.</p>
      <div className="meeting-split">
        {canManage && <form className="panel meeting-form" onSubmit={create}>
          <h2>대상 도메인 추가</h2>
          <label>이름<input name="name" required maxLength={100} autoComplete="off" /></label>
          <label>주소<input name="origin" type="url" inputMode="url" required maxLength={300} autoComplete="off" placeholder="예: http://localhost:8080" /></label>
          <button className="button primary" type="submit" disabled={pending}>{pending ? "추가 중…" : "추가"}</button>
        </form>}
        <section className="panel"><div className="meeting-list">{settings.sites.length ? settings.sites.map((s) => editingId === s.id ?
          <form className="panel compact meeting-form" onSubmit={(e) => saveEdit(e, s.id)} key={s.id}>
            <label>이름<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={100} autoComplete="off" /></label>
            <label>주소<input type="url" inputMode="url" value={draft.origin} onChange={(e) => setDraft({ ...draft, origin: e.target.value })} required maxLength={300} autoComplete="off" /></label>
            <label className="toggle"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> 사용</label>
            <div className="topbar-actions"><button className="button primary" type="submit" disabled={pending}>저장</button><button className="button secondary" type="button" onClick={() => setEditingId(null)}>취소</button></div>
          </form>
          : <article key={s.id}><div><strong>{s.name}</strong><p className="mono">{s.origin}{!s.isActive ? " · 사용 중지" : ""}</p></div>
            {canManage && <div className="topbar-actions"><button className="button secondary" type="button" onClick={() => { setEditingId(s.id); setDraft({ name: s.name, origin: s.origin, isActive: s.isActive }); }}>수정</button></div>}</article>
        ) : <div className="empty">등록된 대상 도메인이 없습니다.</div>}</div></section>
      </div>
    </>;
  }

  // 화면 목록
  const saveOne = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); void run("screens", json("POST", { path: f.get("path"), url: f.get("url") ?? "", name: f.get("name") ?? "", isActive: true }), "화면을 등록했습니다.").then((done) => { if (done) form.reset(); }); };
  async function previewImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = (new FormData(e.currentTarget).get("file") as File | null);
    if (!file?.size) return;
    setImportFile(file); setPending(true); setMessage(null); setPreview(null);
    const body = new FormData(); body.set("file", file);
    try { setPreview(await defectApi<Preview>("screens/import/preview", { method: "POST", body })); } catch (err) { setMessage({ tone: "error", text: (err as Error).message }); } finally { setPending(false); }
  }
  async function commitImport() {
    if (!importFile) return;
    const body = new FormData(); body.set("file", importFile);
    setPending(true);
    try { const r = await defectApi<{ inserted: number; updated: number }>("screens/import/commit", { method: "POST", body }); setMessage({ tone: "ok", text: `반영했습니다. 등록 ${r.inserted}건, 수정 ${r.updated}건` }); setPreview(null); setImportFile(null); router.refresh(); }
    catch (err) { setMessage({ tone: "error", text: (err as Error).message }); } finally { setPending(false); }
  }
  async function downloadErrors() {
    if (!importFile) return;
    const body = new FormData(); body.set("file", importFile);
    const res = await fetch("/api/v1/mp/defects/screens/import/errors", { method: "POST", body });
    if (!res.ok) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(await res.blob()); a.download = "화면목록_오류보고서.xlsx"; a.click(); URL.revokeObjectURL(a.href);
  }

  return <>{msg}
    <form className="filters requirement-filter-panel" method="get"><input type="hidden" name="tab" value="screens" /><input name="q" defaultValue={q} placeholder="화면경로·화면명·URL 검색" aria-label="검색어" /><button className="button secondary" type="submit">조회</button>
      <a className="button secondary" href="/api/v1/mp/defects/screens/export">현재 목록 엑셀</a><a className="button secondary" href="/api/v1/mp/defects/screens/template">양식 내려받기</a></form>
    {canManage && <>
      <form className="panel form-panel" onSubmit={saveOne}>
        <fieldset disabled={pending} className="ut-fieldset">
          <h2 className="ut-section">화면 단건 등록</h2>
          <div className="form-grid">
            <label className="span-2">화면경로 *<input name="path" required maxLength={500} autoComplete="off" placeholder="예: 주문 > 주문 등록 (500자 이내)" /></label>
            <label className="span-2">화면 URL<input name="url" type="url" inputMode="url" maxLength={1000} autoComplete="off" placeholder="http:// 또는 https:// 로 시작, * 로 패턴 지정 가능 (1000자 이내)" /></label>
            <label className="span-2">화면명<input name="name" maxLength={255} autoComplete="off" placeholder="255자 이내" /></label>
          </div>
        </fieldset>
        <div className="form-actions"><button className="button primary" type="submit" disabled={pending}>{pending ? "등록 중…" : "화면 등록"}</button></div>
      </form>
      <form className="panel form-panel" onSubmit={(e) => void previewImport(e)}>
        <fieldset disabled={pending} className="ut-fieldset">
          <h2 className="ut-section">엑셀로 일괄 등록</h2>
          <label>엑셀 파일(.xlsx, 5MB 이하, 5,000행 이내)<input type="file" name="file" accept=".xlsx" /></label>
          <p className="ut-hint">올리면 먼저 내용을 검사해 보여 주고, 오류가 없을 때만 반영할 수 있습니다. 양식은 위의 &quot;양식 내려받기&quot;를 사용하세요.</p>
        </fieldset>
        <div className="form-actions"><button className="button secondary" type="submit" disabled={pending}>{pending ? "검사 중…" : "엑셀 올리기"}</button></div>
      </form>
      {preview && <section className="panel"><div className="panel-head"><h2>미리보기</h2><span>전체 {preview.total}행 · 등록 {preview.insertCount} · 수정 {preview.updateCount} · 오류 {preview.errorCount}</span></div>
        {preview.errorCount > 0 ? <><p className="action-message">오류가 있어 반영할 수 없습니다. 오류를 고쳐 다시 올려 주세요.</p>
          <div className="table-wrap"><table className="ut-table"><thead><tr><th>행</th><th>항목</th><th>사유</th></tr></thead><tbody>{preview.errors.map((er, i) => <tr key={i}><td>{er.rowNumber}</td><td>{er.field}</td><td>{er.message}</td></tr>)}</tbody></table></div>
          <button type="button" className="button secondary" onClick={() => void downloadErrors()}>오류 보고서 내려받기</button></>
          : <><div className="table-wrap"><table className="ut-table"><thead><tr><th>행</th><th>구분</th><th>화면경로</th><th>URL</th><th>화면명</th><th>사용</th></tr></thead><tbody>{preview.rows.map((r) => <tr key={r.rowNumber}><td>{r.rowNumber}</td><td>{r.action}</td><td>{r.path}</td><td>{r.url ?? "–"}</td><td>{r.name}</td><td>{r.isActive ? "Y" : "N"}</td></tr>)}</tbody></table></div>
            <button type="button" className="button primary" disabled={pending} onClick={() => void commitImport()}>반영</button></>}</section>}
    </>}
    <section className="panel compact">{screens.length ? <div className="table-wrap"><table className="ut-table"><thead><tr><th>화면경로</th><th>화면 URL</th><th>화면명</th><th>사용</th></tr></thead>
      <tbody>{screens.map((s) => <tr key={s.id}><td className="defect-wrap">{s.path}</td><td className="mono defect-wrap">{s.url ?? "–"}</td><td className="defect-wrap">{s.name || "–"}</td><td><label><input type="checkbox" checked={s.isActive} disabled={!canManage || pending} onChange={(e) => void run("screens", json("POST", { id: s.id, path: s.path, url: s.url ?? "", name: s.name, isActive: e.target.checked }), "저장했습니다.")} /> 사용</label></td></tr>)}</tbody></table></div> : <div className="empty">등록된 화면이 없습니다. 목록 없이도 결함 등록은 가능합니다.</div>}</section></>;
}

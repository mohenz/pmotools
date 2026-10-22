// PMOTOOLS WBS 상세내용 — 옆 패널 화면.
// 서버 API: /api/v1/ext/wbs/* (로그인 세션 쿠키 + 확장 출처·전용 헤더 확인). 상세내용(description)만 읽고 쓴다.
"use strict";

const DEFAULT_SERVER = "http://10.147.148.101:3020";
const $ = (id) => document.getElementById(id);
const state = { server: DEFAULT_SERVER, task: null, draftTimer: null, searchTimer: null, conflictLatest: null };

// ---------------------------------------------------------------------------
// 저장소(chrome.storage.local) — 설정과 작성 중 임시 내용만 둔다.
// ---------------------------------------------------------------------------
const store = {
  get: (key) => new Promise((resolve) => chrome.storage.local.get(key, (v) => resolve(v[key]))),
  set: (key, value) => new Promise((resolve) => chrome.storage.local.set({ [key]: value }, resolve)),
  remove: (key) => new Promise((resolve) => chrome.storage.local.remove(key, resolve)),
};
const draftKey = (id) => `draft:${state.server}:${id}`;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
class ApiError extends Error {
  constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra; }
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${state.server}/api/v1/ext/wbs/${path}`, {
      method: options.method || "GET",
      credentials: "include",
      headers: { "x-pmo-client": "wbs-ext", ...(options.body ? { "content-type": "application/json" } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", `서버(${state.server})에 연결할 수 없습니다. 사내망 연결과 설정의 접속 서버를 확인해 주세요.`);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const err = payload && payload.error ? payload.error : {};
    throw new ApiError(response.status, err.code || "ERROR", err.message || `요청을 처리하지 못했습니다(${response.status}).`, err);
  }
  return payload ? payload.data : null;
}

// ---------------------------------------------------------------------------
// 화면 전환·메시지
// ---------------------------------------------------------------------------
function show(view) {
  for (const id of ["view-settings", "view-login", "view-list", "view-edit"]) $(id).hidden = id !== view;
}
function message(text, tone) {
  const el = $("message");
  el.hidden = !text;
  el.textContent = text || "";
  el.className = `message${tone ? ` ${tone}` : ""}`;
}
function handleError(error) {
  if (error instanceof ApiError && error.status === 401) { $("who").textContent = ""; show("view-login"); message(error.message, "error"); return; }
  message(error.message || String(error), "error");
}
const fmtDate = (d) => (d ? d.slice(5).replace("-", "/") : "–");

// ---------------------------------------------------------------------------
// 목록
// ---------------------------------------------------------------------------
async function loadMe() {
  const me = await api("me");
  $("who").textContent = `${me.loginId} · ${me.projectCode ? `${me.projectCode} ${me.projectName}` : "프로젝트 미선택"}${me.isTopLevel ? " (하위 프로젝트 포함)" : ""}`;
}

async function loadList() {
  message("");
  const params = new URLSearchParams();
  const q = $("q").value.trim();
  if (q) params.set("q", q);
  if ($("only-empty").checked) params.set("empty", "1");
  try {
    await loadMe();
    const rows = await api(`mine?${params}`);
    show("view-list");
    const list = $("list");
    list.textContent = "";
    $("list-summary").textContent = rows.length ? `내가 담당인 Task ${rows.length}건${rows.length >= 500 ? "(최대 500건 표시)" : ""}` : "조건에 맞는 Task가 없습니다.";
    for (const r of rows) {
      const li = document.createElement("li");
      li.tabIndex = 0;
      li.innerHTML = `<div class="l1"><span class="code"></span><span class="badge"></span></div><div class="name"></div><div class="meta"></div>`;
      li.querySelector(".code").textContent = `${r.code} · ${r.displayId}`;
      const badge = li.querySelector(".badge");
      badge.textContent = r.hasDescription ? "작성됨" : "미작성";
      if (r.hasDescription) badge.classList.add("done");
      li.querySelector(".name").textContent = r.name;
      li.querySelector(".meta").textContent = `${r.stage || "-"} · 계획 ${fmtDate(r.startDate)}~${fmtDate(r.dueDate)} · 진척 ${r.progress}%`;
      const open = () => openTask(r.id);
      li.addEventListener("click", open);
      li.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
      list.appendChild(li);
    }
  } catch (error) { handleError(error); }
}

// ---------------------------------------------------------------------------
// 편집
// ---------------------------------------------------------------------------
function updateCounter() { $("counter").textContent = `${$("desc").value.length.toLocaleString()} / 10,000자`; }

async function openTask(id) {
  message("");
  try {
    const t = await api(encodeURIComponent(id));
    state.task = t;
    state.conflictLatest = null;
    $("task-id").textContent = `${t.projectCode} · ${t.displayId}`;
    $("task-name").textContent = t.name;
    $("task-meta").textContent = `담당 ${t.ownerName || "-"} · 계획 ${t.startDate || "–"} ~ ${t.dueDate || "–"}`;
    $("open-pmotools").href = `${state.server}/mp-wbs/${t.id}`;
    $("desc").value = t.description;
    $("desc").readOnly = !t.canEdit;
    $("btn-save").disabled = !t.canEdit;
    $("btn-template").disabled = !t.canEdit;
    $("readonly-note").hidden = t.canEdit;
    $("conflict").hidden = true;
    $("draft-state").textContent = "";
    updateCounter();
    const draft = await store.get(draftKey(t.id));
    $("draft-banner").hidden = !(t.canEdit && draft && draft.text !== t.description);
    if (draft) $("draft-time").textContent = new Date(draft.savedAt).toLocaleString("ko-KR");
    show("view-edit");
    $("desc").focus();
  } catch (error) { handleError(error); }
}

function scheduleDraft() {
  updateCounter();
  if (!state.task || !state.task.canEdit) return;
  clearTimeout(state.draftTimer);
  state.draftTimer = setTimeout(async () => {
    const text = $("desc").value;
    if (text === state.task.description) { await store.remove(draftKey(state.task.id)); $("draft-state").textContent = ""; return; }
    const savedAt = Date.now();
    await store.set(draftKey(state.task.id), { text, baseVersion: state.task.version, savedAt });
    $("draft-state").textContent = `임시 저장됨 ${new Date(savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
  }, 600);
}

function insertTemplate() {
  const el = $("desc");
  const tpl = state.task ? state.task.template : "";
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const before = el.value.slice(0, start);
  const sep = before && !before.endsWith("\n") ? "\n\n" : "";
  const next = before + sep + tpl + el.value.slice(end);
  if (next.length > 10000) { message("템플릿을 넣으면 10,000자를 넘습니다.", "error"); return; }
  el.value = next;
  el.focus();
  scheduleDraft();
}

async function save(versionOverride) {
  if (!state.task) return;
  const button = $("btn-save");
  button.disabled = true;
  message("");
  try {
    const result = await api(`${encodeURIComponent(state.task.id)}/description`, { method: "PATCH", body: { description: $("desc").value, version: versionOverride || state.task.version } });
    state.task.version = result.version;
    state.task.description = $("desc").value.trim();
    await store.remove(draftKey(state.task.id));
    $("conflict").hidden = true;
    $("draft-banner").hidden = true;
    $("draft-state").textContent = "";
    message("저장했습니다.", "ok");
  } catch (error) {
    if (error instanceof ApiError && error.status === 409 && error.extra && error.extra.latest) {
      state.conflictLatest = error.extra.latest;
      await store.set(draftKey(state.task.id), { text: $("desc").value, baseVersion: state.task.version, savedAt: Date.now() });
      $("conflict-text").value = error.extra.latest.description;
      $("conflict").hidden = false;
      message(error.message, "error");
    } else handleError(error);
  } finally {
    button.disabled = !(state.task && state.task.canEdit);
  }
}

// ---------------------------------------------------------------------------
// 이벤트
// ---------------------------------------------------------------------------
async function init() {
  state.server = (await store.get("server")) || DEFAULT_SERVER;
  $("server").value = state.server;
  $("btn-settings").addEventListener("click", () => { message(""); show("view-settings"); });
  $("btn-settings-done").addEventListener("click", async () => { state.server = $("server").value; await store.set("server", state.server); loadList(); });
  $("btn-login").addEventListener("click", () => window.open(`${state.server}/login`, "_blank", "noopener"));
  $("btn-refresh").addEventListener("click", () => (state.task && !$("view-edit").hidden ? openTask(state.task.id) : loadList()));
  $("q").addEventListener("input", () => { clearTimeout(state.searchTimer); state.searchTimer = setTimeout(loadList, 300); });
  $("only-empty").addEventListener("change", loadList);
  $("btn-back").addEventListener("click", () => { state.task = null; loadList(); });
  $("desc").addEventListener("input", scheduleDraft);
  $("btn-template").addEventListener("click", insertTemplate);
  $("btn-save").addEventListener("click", () => save());
  $("btn-draft-restore").addEventListener("click", async () => { const d = await store.get(draftKey(state.task.id)); if (d) { $("desc").value = d.text; updateCounter(); } $("draft-banner").hidden = true; });
  $("btn-draft-discard").addEventListener("click", async () => { await store.remove(draftKey(state.task.id)); $("draft-banner").hidden = true; });
  $("btn-conflict-load").addEventListener("click", () => {
    if (!state.conflictLatest) return;
    state.task.version = state.conflictLatest.version;
    state.task.description = state.conflictLatest.description;
    $("desc").value = state.conflictLatest.description;
    $("conflict").hidden = true;
    updateCounter();
    message("최신 내용을 불러왔습니다. 내가 쓴 내용은 임시 저장에서 복구할 수 있습니다.", "ok");
    $("draft-banner").hidden = false;
  });
  $("btn-conflict-overwrite").addEventListener("click", () => {
    if (!state.conflictLatest) return;
    if (!confirm("다른 사용자가 수정한 내용을 내 내용으로 덮어씁니다. 계속할까요?")) return;
    save(state.conflictLatest.version);
  });
  loadList();
}

init();

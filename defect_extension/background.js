// 확장 아이콘을 누르면 현재 화면을 캡처하고 PMOTOOLS 결함 등록 창(전용 팝업 창)을 연 뒤 수집 데이터를 전달한다.
// 등록 창은 확장이 직접 만들고 그 창 안에 브리지 스크립트를 주입한다(페이지의 window.open은 사용자 동작이 없어 차단될 수 있다).
// 메시지 규격: PMO_DEFECT_READY(등록 화면 → 브리지), PMO_DEFECT_DATA(브리지 → 등록 화면), PMO_DEFECT_CLOSE(등록 화면 → 브리지, 창 닫기).
// 등록 화면은 수집한 페이지 주소가 "대상 도메인 관리"에 등록된 활성 출처일 때만 데이터를 받는다.
const DEFAULT_URL = "http://localhost:3020";
const KEY = (tabId) => `pmo_pending_${tabId}`;

// 테스트 대상 페이지에서 화면명·메뉴명을 읽는다(위젯과 같은 규칙).
function readPageInfo() {
  const meta = (n) => (document.querySelector(`meta[name="${n}"]`)?.getAttribute("content") || "").trim();
  const text = (sels) => { for (const s of sels) { const v = document.querySelector(s)?.textContent?.replace(/\s+/g, " ").trim(); if (v) return v; } return ""; };
  let url = location.href; try { const u = new URL(url); u.hash = ""; url = u.href; } catch { /* 그대로 */ }
  return {
    pageUrl: url, pageTitle: document.title, userAgent: navigator.userAgent,
    menuName: meta("pmo:menu-name") || text([".store-name", "header .logo", ".logo", ".site-title", "header h1"]) || location.hostname,
    screenName: meta("pmo:screen-name") || text(["h1", "main h2", ".page-title", ".contents-title"]) || document.title || "",
  };
}

// 등록 창 안에서 동작: 등록 화면의 READY에 데이터를 응답하고, CLOSE를 받으면 확장에 창 닫기를 요청한다.
function bridge(origin, payload) {
  if (window.__pmoBridge) return;
  window.__pmoBridge = true;
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== origin || !e.data) return;
    if (e.data.type === "PMO_DEFECT_READY") window.postMessage({ type: "PMO_DEFECT_DATA", payload }, origin);
    else if (e.data.type === "PMO_DEFECT_CLOSE") chrome.runtime.sendMessage({ type: "PMO_DEFECT_CLOSE" });
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https?:/i.test(tab.url || "")) return;
  const { pmotoolsUrl } = await chrome.storage.sync.get({ pmotoolsUrl: DEFAULT_URL });
  const origin = new URL(pmotoolsUrl).origin;
  if (!(await chrome.permissions.contains({ origins: [`${origin}/*`] }))) { await chrome.runtime.openOptionsPage(); return; } // 설정에서 PMOTOOLS 주소를 저장하며 권한을 허용한다
  let screenshot = "";
  try { screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }); } catch { screenshot = ""; }
  let info = { pageUrl: tab.url, pageTitle: tab.title || "", userAgent: "", menuName: "", screenName: "" };
  try { const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readPageInfo }); if (r?.result) info = r.result; } catch { /* 일부 페이지는 읽을 수 없다 */ }
  const payload = { ...info, screenshot, title: info.screenName ? `[${info.screenName}] 결함 보고` : "", source: "EXTENSION" };
  const win = await chrome.windows.create({ url: `${origin}/mp-defects/new?popup=1`, type: "popup", width: 1000, height: 900 });
  const popupTab = win.tabs?.[0];
  if (popupTab?.id) await chrome.storage.session.set({ [KEY(popupTab.id)]: { origin, payload } });
});

// 등록 창이 (로그인 이동 등으로) 새 문서를 불러올 때마다 브리지를 다시 주입한다.
chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (change.status !== "loading" && change.status !== "complete") return;
  const pending = (await chrome.storage.session.get(KEY(tabId)))[KEY(tabId)];
  if (!pending || !tab.url || new URL(tab.url).origin !== pending.origin) return;
  chrome.scripting.executeScript({ target: { tabId }, func: bridge, args: [pending.origin, pending.payload], injectImmediately: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "PMO_DEFECT_CLOSE" && sender.tab?.id) chrome.tabs.remove(sender.tab.id).catch(() => {});
});
chrome.tabs.onRemoved.addListener((tabId) => { chrome.storage.session.remove(KEY(tabId)); });

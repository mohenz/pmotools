/*
 * PMOTOOLS 결함 등록 위젯 — 테스트 대상 사이트에 한 줄로 넣는다.
 *   <script src="http://localhost:3020/defect-widget/pmo-defect-widget.js" data-pmotools-url="http://localhost:3020" defer></script>
 * 오른쪽 아래 벌레 버튼을 누르면 현재 보이는 화면을 캡처하고, 주소·제목·화면명·메뉴명·브라우저 정보와 함께 PMOTOOLS 결함 등록 창에 전달한다.
 * 이 사이트의 주소는 PMOTOOLS 결함관리 > 설정 > 대상 도메인에 등록되어 있어야 한다.
 *
 * 선택 속성(script 태그): data-test-stage(단계 코드·이름), data-case-id, data-menu-name, data-screen-name, data-button="none"(자체 버튼 사용 시)
 * 선택 메타(head): <meta name="pmo:menu-name" content="…">, <meta name="pmo:screen-name" content="…">
 * 자체 버튼에서 호출: window.PmoDefectWidget.open()
 * 메시지 규격: PMO_DEFECT_READY(창 → 페이지), PMO_DEFECT_DATA(페이지 → 창), PMO_DEFECT_CLOSE(창 → 페이지).
 */
(function () {
  var script = document.currentScript;
  var base = (script && script.getAttribute("data-pmotools-url")) || (script && new URL(script.src).origin) || "";
  var origin;
  try { origin = new URL(base).origin; } catch (e) { return; }
  var attr = function (name) { return (script && script.getAttribute(name)) || ""; };
  var HTML2CANVAS = "https://cdn.jsdelivr.net/npm/html2canvas-pro@2.0.2/dist/html2canvas-pro.min.js";
  var MAX_DATA_URL = 6000000; // 캡처 이미지 data URL 길이 상한(약 4.5MB) — 넘으면 줄여서 다시 만든다

  function meta(name) { var m = document.querySelector('meta[name="' + name + '"]'); return m ? (m.getAttribute("content") || "").trim() : ""; }
  function text(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      var n = document.querySelector(selectors[i]);
      var v = n && n.textContent ? n.textContent.replace(/\s+/g, " ").trim() : "";
      if (v) return v;
    }
    return "";
  }
  function menuName() { return attr("data-menu-name") || meta("pmo:menu-name") || text([".store-name", "header .logo", ".logo", ".site-title", "header h1"]) || location.hostname; }
  function screenName() { return attr("data-screen-name") || meta("pmo:screen-name") || text(["h1", "main h2", ".page-title", ".contents-title"]) || document.title || ""; }
  function pageUrl() { try { var u = new URL(location.href); u.hash = ""; return u.href; } catch (e) { return location.href; } }

  function html2canvasLib() {
    if (typeof window.html2canvas === "function") return window.html2canvas;
    if (window.html2canvas && typeof window.html2canvas.default === "function") return window.html2canvas.default;
    return null;
  }
  function loadHtml2Canvas() {
    var lib = html2canvasLib();
    if (lib) return Promise.resolve(lib);
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = HTML2CANVAS; s.async = true; s.crossOrigin = "anonymous";
      s.onload = function () { var l = html2canvasLib(); l ? resolve(l) : reject(new Error("html2canvas missing")); };
      s.onerror = function () { reject(new Error("html2canvas load failed")); };
      document.head.appendChild(s);
    });
  }
  function shrink(canvas, ratio) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(canvas.width * ratio)); c.height = Math.max(1, Math.round(canvas.height * ratio));
    var ctx = c.getContext("2d");
    if (!ctx) return canvas;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(canvas, 0, 0, c.width, c.height);
    return c;
  }
  function toDataUrl(canvas) {
    var work = canvas, smallest = "";
    for (var attempt = 0; attempt < 5; attempt += 1) {
      var tries = [["image/webp", 0.9], ["image/jpeg", 0.85], ["image/jpeg", 0.7]];
      for (var i = 0; i < tries.length; i += 1) {
        var url = work.toDataURL(tries[i][0], tries[i][1]);
        if (!url || url === "data:,") continue;
        if (!smallest || url.length < smallest.length) smallest = url;
        if (url.length <= MAX_DATA_URL) return url;
      }
      if (Math.max(work.width, work.height) <= 800) break;
      work = shrink(work, 0.8);
    }
    return smallest;
  }
  // 현재 보이는 화면(뷰포트)만 캡처한다. 실패해도 결함 등록은 계속할 수 있도록 빈 문자열을 돌려준다.
  function capture(button) {
    return loadHtml2Canvas().then(function (h2c) {
      var x = Math.max(window.scrollX || 0, 0), y = Math.max(window.scrollY || 0, 0);
      var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0), h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
      var scale = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(16000000 / Math.max(w * h, 1))));
      if (button) button.style.visibility = "hidden"; // 위젯 버튼이 캡처에 찍히지 않게 한다
      return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }).then(function () {
        return h2c(document.documentElement, { logging: false, useCORS: true, allowTaint: false, scale: scale, backgroundColor: "#ffffff", imageTimeout: 15000, width: w, height: h, x: x, y: y, scrollX: x, scrollY: y, windowWidth: w, windowHeight: h });
      }).then(toDataUrl).then(function (url) { if (button) button.style.visibility = ""; return url; }, function (e) { if (button) button.style.visibility = ""; throw e; });
    }).catch(function (e) { if (window.console) console.warn("[PMOTOOLS] 화면 캡처를 건너뜁니다:", e && e.message); return ""; });
  }

  var button = null;
  function open() {
    // 비동기 캡처 뒤에 열면 팝업이 차단되므로 클릭 시점에 먼저 연다.
    var popup = window.open("about:blank", "pmo_defect_popup", "popup=yes,width=1000,height=900,resizable=yes,scrollbars=yes");
    if (!popup) { alert("팝업이 차단되었습니다. 이 사이트의 팝업을 허용해 주세요."); return; }
    if (button) { button.disabled = true; button.setAttribute("data-busy", "1"); }
    capture(button).then(function (screenshot) {
      var shortName = screenName();
      var payload = {
        pageUrl: pageUrl(), pageTitle: document.title, userAgent: navigator.userAgent, screenshot: screenshot,
        title: "[" + shortName + "] 결함 보고", menuName: menuName(), screenName: shortName, source: "WIDGET",
      };
      if (attr("data-test-stage")) payload.testStage = attr("data-test-stage");
      if (attr("data-case-id")) payload.caseId = attr("data-case-id");
      // 로그인 이동 등으로 등록 창이 다시 READY를 보내면 같은 데이터를 다시 보낸다. 창이 닫히면 정리한다.
      function onMessage(event) {
        if (event.origin !== origin || event.source !== popup || !event.data) return;
        if (event.data.type === "PMO_DEFECT_READY") popup.postMessage({ type: "PMO_DEFECT_DATA", payload: payload }, origin);
        else if (event.data.type === "PMO_DEFECT_CLOSE") stop();
      }
      var timer = setInterval(function () { if (popup.closed) stop(); }, 1000);
      function stop() { window.removeEventListener("message", onMessage); clearInterval(timer); }
      window.addEventListener("message", onMessage);
      popup.location.href = origin + "/mp-defects/new?popup=1";
    }).then(done, done);
    function done() { if (button) { button.disabled = false; button.removeAttribute("data-busy"); } }
  }
  window.PmoDefectWidget = { open: open };

  function mount() {
    if (attr("data-button") === "none" || document.getElementById("pmo-defect-widget-btn")) return;
    button = document.createElement("button");
    button.id = "pmo-defect-widget-btn"; button.type = "button";
    button.setAttribute("aria-label", "PMOTOOLS 결함 등록"); button.title = "결함 발견! 리포트 하기";
    button.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2l1.9 1.9M16 2l-1.9 1.9"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20a6 6 0 0 1-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3a6 6 0 0 1-6 6z"/><path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>';
    button.style.cssText = "position:fixed;right:24px;bottom:24px;z-index:2147483647;width:56px;height:56px;border:0;border-radius:50%;background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(239,68,68,.45)";
    button.addEventListener("click", open);
    document.body.appendChild(button);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
})();

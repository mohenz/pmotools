const input = document.getElementById("url");
const msg = document.getElementById("msg");
chrome.storage.sync.get({ pmotoolsUrl: "http://localhost:3020" }, (v) => { input.value = v.pmotoolsUrl; });
document.getElementById("save").addEventListener("click", async () => {
  let origin;
  try { const u = new URL(input.value.trim()); if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error(); origin = u.origin; }
  catch { msg.textContent = "주소 형식이 올바르지 않습니다."; return; }
  // 등록 창에 캡처 데이터를 전달하려면 PMOTOOLS 주소에 대한 접근 허용이 필요하다(클릭 직후에만 요청할 수 있다).
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
  if (!granted) { msg.textContent = "접근 허용이 필요합니다. 다시 저장해 주세요."; return; }
  chrome.storage.sync.set({ pmotoolsUrl: origin }, () => { input.value = origin; msg.textContent = "저장했습니다."; });
});

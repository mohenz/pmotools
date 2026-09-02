"use client";

// 리포트 인쇄보기 — 탭이 아니라 화면 대부분을 채우는 별도 팝업 창으로 띄운다.
// embedded=1은 AuthenticatedAppShell이 상단 메뉴·왼쪽 사이드바 없이 콘텐츠만 렌더링하도록 하는 기존 규약이다
// (로그인 화면의 캘린더/회의실 공개 미리보기와 동일한 방식).
export function WeeklyReportPrintLink({ href }: { href: string }) {
  const popupHref = `${href}${href.includes("?") ? "&" : "?"}embedded=1`;
  function openPopup(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const width = Math.round(window.screen.width * 0.9);
    const height = Math.round(window.screen.height * 0.9);
    const left = Math.round((window.screen.width - width) / 2);
    const top = Math.round((window.screen.height - height) / 2);
    window.open(popupHref, "weekly-report-print", `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no`);
  }
  return <a className="button secondary" href={popupHref} onClick={openPopup} target="_blank" rel="noopener noreferrer">리포트 인쇄보기</a>;
}

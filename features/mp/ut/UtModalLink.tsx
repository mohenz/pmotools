"use client";

import type { MouseEvent, ReactNode } from "react";

// 목록에서 케이스 모달을 여는 링크 — 주소(?case=·?new=)만 브라우저 history로 바꾸고 서버 재렌더링은 하지 않는다(2026-10-21 로딩속도 개선).
// Next 15는 history.pushState를 useSearchParams와 동기화하므로 모달은 바뀐 주소를 읽어 자기 데이터만 불러온다.
// 새 탭(Ctrl·Shift·가운데 버튼)으로 열 때는 일반 링크로 동작한다.
export function UtModalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState(null, "", href);
  };
  return <a href={href} className={className} onClick={onClick}>{children}</a>;
}

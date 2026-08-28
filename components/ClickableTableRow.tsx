"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

export function ClickableTableRow({ href, ariaLabel, children }: { href: string; ariaLabel: string; children: ReactNode }) {
  const router = useRouter();

  function open(event: MouseEvent<HTMLTableRowElement>) {
    if ((event.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
    router.push(href);
  }

  function openWithKeyboard(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    router.push(href);
  }

  return <tr className="clickable-table-row" role="link" tabIndex={0} aria-label={ariaLabel} onClick={open} onKeyDown={openWithKeyboard}>{children}</tr>;
}

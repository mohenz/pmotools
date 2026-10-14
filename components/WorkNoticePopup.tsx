"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useEffect, useState } from "react";
import { isHiddenToday, koreaDateKey, workImpactLabel, workImpactTone, workNoticeHideKey, workNoticePhase, WORK_PHASE_LABEL, formatWorkPeriod } from "@/lib/domain/work-notice";
import type { ActiveWorkNotice } from "@/lib/server/announcements";

// 작업 알림 팝업(2026-10-01 결정) — 로그인 후 현재 프로젝트의 작업 알림(안내 시작~작업 종료)을 한 번에 보여 준다.
//  - [오늘 하루 보지 않기]: 이 브라우저에서 오늘(한국 날짜)만 숨김 → 다음 날 다시 표시(작업 종료 전까지)
//  - [닫기]: 이 브라우저 탭을 닫기 전까지 다시 띄우지 않음
// 브라우저 저장소는 막혀 있을 수 있어(사생활 보호 모드 등) 모든 접근을 try/catch로 감싼다.
const CLOSED_KEY = "pmotools-work-notice-closed";
const read = (storage: () => Storage, key: string) => { try { return storage().getItem(key); } catch { return null; } };
const write = (storage: () => Storage, key: string, value: string) => { try { storage().setItem(key, value); } catch { /* 저장 불가 — 이번 표시만 닫는다 */ } };

export function WorkNoticePopup() {
  const [notices, setNotices] = useState<ActiveWorkNotice[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/announcements/work-notices").then((response) => (response.ok ? response.json() : null)).then((payload) => {
      if (cancelled || !payload?.data?.length) return;
      const today = koreaDateKey();
      const closed = (read(() => sessionStorage, CLOSED_KEY) ?? "").split(",");
      const visible = (payload.data as ActiveWorkNotice[]).filter((notice) => !isHiddenToday(read(() => localStorage, workNoticeHideKey(notice.id)), today) && !closed.includes(notice.id));
      setNotices(visible);
      setOpen(visible.length > 0);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  function hideToday() {
    const today = koreaDateKey();
    for (const notice of notices) write(() => localStorage, workNoticeHideKey(notice.id), today);
    setOpen(false);
  }
  function close() {
    const closed = new Set((read(() => sessionStorage, CLOSED_KEY) ?? "").split(",").filter(Boolean));
    for (const notice of notices) closed.add(notice.id);
    write(() => sessionStorage, CLOSED_KEY, [...closed].join(","));
    setOpen(false);
  }

  if (!notices.length) return null;
  const now = new Date();
  return <Dialog.Root open={open} onOpenChange={(value) => { if (!value) close(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="calendar-modal-backdrop" />
      <Dialog.Content className="alert-dialog work-notice-dialog" aria-describedby={undefined}>
        <Dialog.Title asChild><h2>작업 안내</h2></Dialog.Title>
        <div className="work-notice-list">
          {notices.map((notice) => {
            const phase = workNoticePhase(now, notice.noticeStartAt, notice.workStartAt, notice.workEndAt);
            return <article key={notice.id} className={`work-notice phase-${phase.toLowerCase()}`}>
              <header>
                <span className={`badge ${phase === "IN_PROGRESS" ? "band-red" : "band-yellow"}`}>{WORK_PHASE_LABEL[phase]}</span>
                {notice.workImpact && <span className={`badge ${workImpactTone(notice.workImpact)}`}>{workImpactLabel(notice.workImpact)}</span>}
                <strong>{notice.title}</strong>
              </header>
              <p className="work-notice-period">작업 시간 {formatWorkPeriod(notice.workStartAt, notice.workEndAt)}</p>
              <p className="work-notice-content">{notice.content}</p>
              <Link className="table-link" href={`/announcements/${notice.id}`} onClick={close}>공지 자세히 보기</Link>
            </article>;
          })}
        </div>
        <div className="alert-dialog-actions">
          <button className="button secondary" type="button" onClick={hideToday}>오늘 하루 보지 않기</button>
          <button className="button primary" type="button" onClick={close}>닫기</button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

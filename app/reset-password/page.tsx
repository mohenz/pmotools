"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function ResetPasswordRequestPage() {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const data = new FormData(event.currentTarget);
    await fetch("/api/auth/reset-password-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: String(data.get("userId") ?? ""),
        note: String(data.get("note") ?? ""),
      }),
    });
    setPending(false);
    setDone(true);
  }

  return (
    <div className="auth-center">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/pmotools-logo.png" alt="PMOTOOLS" />
          <h1>비밀번호 초기화</h1>
          <p>Project Management Tools</p>
        </div>
        <div className="auth-divider" />
        {done ? (
          <p className="auth-hint" style={{ margin: 0 }}>요청이 접수되었습니다. 관리자가 확인 후 비밀번호를 초기화하면 별도로 안내해 드립니다.</p>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <label>아이디<input name="userId" autoComplete="username" placeholder="아이디 입력" required maxLength={50} /></label>
            <label>메모(선택)<input name="note" placeholder="관리자에게 전달할 내용" maxLength={200} /></label>
            <p className="auth-hint">아이디를 입력하면 관리자에게 초기화를 요청합니다. 관리자가 확인 후 임시 비밀번호를 발급합니다.</p>
            <button className="auth-submit" disabled={pending}>{pending ? "요청 중…" : "초기화 요청"}</button>
          </form>
        )}
        <div className="auth-footer-links center">
          <Link href="/login">로그인으로 이동</Link>
        </div>
      </div>
    </div>
  );
}

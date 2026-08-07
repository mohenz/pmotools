"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: String(data.get("userId") ?? ""),
        name: String(data.get("name") ?? ""),
        password: String(data.get("password") ?? ""),
      }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setMessage(payload?.error?.message ?? "가입에 실패했습니다.");
      return;
    }
    router.push("/login");
  }

  return (
    <>
      <header className="topbar"><div><h1>회원가입</h1><p>아이디, 이름, 비밀번호만으로 가입합니다.</p></div></header>
      <div className="content">
        <section className="panel" style={{ maxWidth: 420 }}>
          <form className="calendar-event-form" onSubmit={submit}>
            <label>아이디<input name="userId" autoComplete="username" required maxLength={50} /></label>
            <label>이름<input name="name" autoComplete="name" required maxLength={50} /></label>
            <label>비밀번호<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={100} /></label>
            {message && <p className="form-error">{message}</p>}
            <div className="topbar-actions">
              <button className="button primary" disabled={pending}>{pending ? "가입 중…" : "가입하기"}</button>
              <Link className="button secondary" href="/login">로그인으로</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

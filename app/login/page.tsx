"use client";

import { FormEvent, Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      userId: String(data.get("userId") ?? ""),
      password: String(data.get("password") ?? ""),
      redirect: false,
    });
    setPending(false);
    if (result?.error) {
      setMessage("아이디 또는 비밀번호가 일치하지 않습니다.");
      return;
    }
    router.push(params.get("callbackUrl") ?? "/");
    router.refresh();
  }

  return (
    <form className="calendar-event-form" onSubmit={submit}>
      <label>아이디<input name="userId" autoComplete="username" required maxLength={50} /></label>
      <label>비밀번호<input name="password" type="password" autoComplete="current-password" required maxLength={100} /></label>
      {message && <p className="form-error">{message}</p>}
      <div className="topbar-actions">
        <button className="button primary" disabled={pending}>{pending ? "로그인 중…" : "로그인"}</button>
        <Link className="button secondary" href="/signup">회원가입</Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <>
      <header className="topbar"><div><h1>로그인</h1><p>아이디와 비밀번호로 로그인합니다.</p></div></header>
      <div className="content">
        <section className="panel" style={{ maxWidth: 420 }}>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </>
  );
}

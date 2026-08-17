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
    <form className="auth-form" onSubmit={submit}>
      <label>아이디<input name="userId" autoComplete="username" placeholder="아이디 입력" required maxLength={50} /></label>
      <label>비밀번호<input name="password" type="password" autoComplete="current-password" placeholder="••••••••" required maxLength={100} /></label>
      {message && <p className="form-error">{message}</p>}
      <button className="auth-submit" disabled={pending}>{pending ? "로그인 중…" : "로그인"}</button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-center">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/pmotools-logo.png" alt="PMOTOOLS" />
          <h1>PMOTOOLS</h1>
          <p>Project Management Tools</p>
        </div>
        <div className="auth-divider" />
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <div className="auth-footer-links">
          <Link href="/signup">회원가입</Link>
          <Link href="/reset-password">비밀번호 초기화</Link>
        </div>
      </div>
    </div>
  );
}

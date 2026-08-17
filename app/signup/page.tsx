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
        department: String(data.get("department") ?? ""),
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
    <div className="auth-center">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/pmotools-logo.png" alt="PMOTOOLS" />
          <h1>계정 생성</h1>
          <p>Project Management Tools</p>
        </div>
        <div className="auth-divider" />
        <form className="auth-form" onSubmit={submit}>
          <label>아이디<input name="userId" autoComplete="username" placeholder="아이디를 입력하세요" required maxLength={50} /></label>
          <label>이름<input name="name" autoComplete="name" placeholder="이름을 입력하세요" required maxLength={50} /></label>
          <label>회사명<input name="department" autoComplete="organization" placeholder="회사명을 입력하세요" maxLength={100} /></label>
          <label>
            비밀번호<input name="password" type="password" autoComplete="new-password" placeholder="••••••••" required minLength={8} maxLength={100} />
          </label>
          <p className="auth-hint">영문/숫자 조합 8자 이상</p>
          {message && <p className="form-error">{message}</p>}
          <button className="auth-submit" disabled={pending}>{pending ? "가입 중…" : "가입하기"}</button>
        </form>
        <div className="auth-footer-links center">
          <Link href="/login">로그인으로 이동</Link>
        </div>
      </div>
    </div>
  );
}

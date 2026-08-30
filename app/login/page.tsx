"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PublicReadOnlyModal } from "@/components/PublicReadOnlyModal";

const SAVED_USER_ID_KEY = "pmotools:savedUserId";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState("");
  const [rememberUserId, setRememberUserId] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_USER_ID_KEY);
      if (saved) { setUserId(saved); setRememberUserId(true); }
    } catch { /* private browsing 등에서 storage 접근이 막힐 수 있음 */ }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      userId,
      password: String(data.get("password") ?? ""),
      redirect: false,
    });
    setPending(false);
    if (result?.error) {
      setMessage("아이디 또는 비밀번호가 일치하지 않습니다.");
      return;
    }
    try {
      if (rememberUserId) localStorage.setItem(SAVED_USER_ID_KEY, userId);
      else localStorage.removeItem(SAVED_USER_ID_KEY);
    } catch { /* private browsing 등에서 storage 접근이 막힐 수 있음 */ }
    router.push(params.get("callbackUrl") ?? "/announcements");
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>아이디<input name="userId" autoComplete="username" placeholder="아이디 입력" required maxLength={50} value={userId} onChange={(event) => setUserId(event.target.value)} /></label>
      <label>비밀번호<input name="password" type="password" autoComplete="current-password" placeholder="••••••••" required maxLength={100} /></label>
      <label className="toggle auth-remember"><input type="checkbox" checked={rememberUserId} onChange={(event) => setRememberUserId(event.target.checked)} /> 아이디 저장</label>
      {message && <p className="form-error">{message}</p>}
      <button className="auth-submit" disabled={pending}>{pending ? "로그인 중…" : "로그인"}</button>
    </form>
  );
}

export default function LoginPage() {
  const [publicView, setPublicView] = useState<"calendar" | "meetrooms" | null>(null);
  return (
    <div className="auth-center">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/pmotools-logo-login.png" alt="PMOTOOLS" />
        </div>
        <div className="auth-divider" />
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <div className="auth-footer-links">
          <Link href="/signup">회원가입</Link>
          <Link href="/reset-password">비밀번호 초기화</Link>
        </div>
        <div className="public-view-links" aria-label="로그인 없이 조회">
          <button type="button" onClick={() => setPublicView("calendar")}>캘린더 조회</button>
          <button type="button" onClick={() => setPublicView("meetrooms")}>회의실 예약현황 조회</button>
        </div>
      </div>
      {publicView ? <PublicReadOnlyModal view={publicView} onClose={() => setPublicView(null)} /> : null}
    </div>
  );
}

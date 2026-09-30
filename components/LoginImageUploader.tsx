"use client";

import { useEffect, useRef, useState } from "react";

export function LoginImageUploader() {
  const [currentUrl, setCurrentUrl] = useState<string>("/bg_image1.png");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/v1/settings/login-image")
      .then((res) => res.json())
      .then((data) => { if (data.url) setCurrentUrl(data.url); })
      .catch(() => {});
  }, []);

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleUpload(file: File) {
    if (!file) return;
    setLoading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch("/api/v1/settings/login-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { showMessage("error", data.error ?? "업로드 실패"); return; }
      setCurrentUrl(data.url);
      showMessage("success", "로그인 배경 이미지가 변경되었습니다.");
    } catch {
      showMessage("error", "업로드 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRestore() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/settings/login-image", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { showMessage("error", data.error ?? "복원 실패"); return; }
      setCurrentUrl(data.url);
      showMessage("success", "기본 이미지로 복원되었습니다.");
    } catch {
      showMessage("error", "복원 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  return (
    <section className="panel login-image-settings-panel">
      <div className="panel-head">
        <div>
          <h2>로그인 화면 배경 이미지</h2>
          <p>로그인 페이지 왼쪽 패널에 표시되는 배경 이미지를 변경합니다. (JPEG, PNG, WebP / 최대 5MB)</p>
        </div>
      </div>
      <div className="login-image-uploader">
        <div className="login-image-preview-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={currentUrl}
            src={currentUrl}
            alt="현재 로그인 배경 이미지"
            className="login-image-preview"
          />
          <span className="login-image-preview-label">현재 적용 이미지</span>
        </div>
        <div className="login-image-actions">
          <input
            ref={fileInputRef}
            id="login-image-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={onFileChange}
            disabled={loading}
          />
          <label
            htmlFor="login-image-file"
            className={`button primary login-image-upload-btn${loading ? " disabled" : ""}`}
            aria-disabled={loading}
          >
            {loading ? <span className="loader" role="status" aria-label="처리 중" /> : "이미지 업로드"}
          </label>
          <button
            type="button"
            className="button secondary"
            onClick={handleRestore}
            disabled={loading}
          >
            기본 이미지로 복원
          </button>
        </div>
        {message && (
          <p className={`login-image-message ${message.type}`} role="status">
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}

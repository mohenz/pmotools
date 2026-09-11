"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, File, AlertCircle, CheckCircle } from "lucide-react";

export function IcsUploadModal({ returnUrl }: { returnUrl: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewEvents, setPreviewEvents] = useState<any[] | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setPreviewEvents(null);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/calendar-events/import-ics", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "미리보기 생성에 실패했습니다.");
      }

      setPreviewEvents(data.events);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!previewEvents || previewEvents.length === 0) return;
    setIsUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/calendar-events/import-ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: previewEvents }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "일정 등록에 실패했습니다.");
      }

      router.push(returnUrl);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="ics-upload-modal" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      {!previewEvents ? (
        <>
          <div style={{ border: "2px dashed var(--border)", borderRadius: "8px", padding: "2rem", textAlign: "center" }}>
            <UploadCloud size={48} style={{ margin: "0 auto 1rem", color: "var(--text-muted)" }} />
            <p style={{ marginBottom: "1rem" }}>.ics 파일을 선택하거나 드래그하여 업로드하세요.</p>
            <input
              type="file"
              accept=".ics"
              onChange={handleFileChange}
              style={{ display: "none" }}
              id="ics-file-input"
            />
            <label htmlFor="ics-file-input" className="button secondary" style={{ cursor: "pointer" }}>
              파일 선택
            </label>
            {file && (
              <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                <File size={16} />
                <span>{file.name}</span>
              </div>
            )}
          </div>

          {error && (
            <div style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="button secondary" onClick={() => router.push(returnUrl)}>
              취소
            </button>
            <button
              type="button"
              className="button primary"
              onClick={handlePreview}
              disabled={!file || isUploading}
            >
              {isUploading ? "처리 중..." : "미리보기"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--success)", fontWeight: "bold" }}>
            <CheckCircle size={20} />
            <span>총 {previewEvents.length}건의 일정이 확인되었습니다.</span>
          </div>
          
          <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "4px" }}>
            <table className="data-table" style={{ width: "100%", fontSize: "0.9rem" }}>
              <thead style={{ position: "sticky", top: 0, backgroundColor: "var(--bg-panel)" }}>
                <tr>
                  <th style={{ padding: "0.5rem", textAlign: "left" }}>제목</th>
                  <th style={{ padding: "0.5rem", textAlign: "left" }}>일시</th>
                  <th style={{ padding: "0.5rem", textAlign: "left" }}>장소</th>
                  <th style={{ padding: "0.5rem", textAlign: "left" }}>참석자 (매핑됨)</th>
                </tr>
              </thead>
              <tbody>
                {previewEvents.map((ev, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem" }}>
                      {ev.title}
                      {ev.note && <div style={{ fontSize: "0.8rem", color: "var(--danger)", marginTop: "0.25rem", whiteSpace: "pre-line" }}>{ev.note}</div>}
                    </td>
                    <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                      {new Date(ev.startAt).toLocaleString("ko-KR", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                      <br />~ {new Date(ev.endAt).toLocaleString("ko-KR", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                    </td>
                    <td style={{ padding: "0.5rem" }}>{ev.location || "-"}</td>
                    <td style={{ padding: "0.5rem" }}>{ev.assignees?.length || 0}명</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="button secondary" onClick={() => setPreviewEvents(null)}>
              다시 선택
            </button>
            <button
              type="button"
              className="button primary"
              onClick={handleConfirm}
              disabled={isUploading}
            >
              {isUploading ? "등록 중..." : "일정 등록하기"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

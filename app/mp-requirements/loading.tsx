// [WBS2 복사본] 원본: app/requirements/loading.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
export default function RequirementsLoading() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="skeleton skeleton-title">요구사항정의서</h1>
          <p className="skeleton skeleton-line" style={{ width: 160, marginTop: 8 }} />
        </div>
      </header>
      <div className="content">
        <section className="panel">
          <div className="panel-head">
            <h2 className="skeleton skeleton-line" style={{ width: 140 }} />
          </div>
          {Array.from({ length: 8 }, (_, i) => <div className="skeleton skeleton-row" style={{ marginBottom: 8 }} key={i} />)}
        </section>
      </div>
    </>
  );
}

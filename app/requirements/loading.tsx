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

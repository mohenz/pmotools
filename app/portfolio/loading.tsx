export default function PortfolioLoading() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="skeleton skeleton-title">통합 대시보드</h1>
          <p className="skeleton skeleton-line" style={{ width: 220, marginTop: 8 }} />
        </div>
      </header>
      <div className="content">
        <section className="kpi-grid">
          {Array.from({ length: 4 }, (_, i) => <div className="kpi skeleton skeleton-kpi" key={i} />)}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2 className="skeleton skeleton-line" style={{ width: 140 }} />
          </div>
          <div className="progress-board">
            {Array.from({ length: 6 }, (_, i) => <div className="progress-card skeleton skeleton-card" key={i} />)}
          </div>
        </section>
      </div>
    </>
  );
}

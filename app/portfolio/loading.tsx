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
        <section className="portfolio-domain-grid">
          {Array.from({ length: 3 }, (_, i) => <div className="panel skeleton skeleton-kpi" key={i} />)}
        </section>
        <section className="action-grid">
          {Array.from({ length: 2 }, (_, i) => <div className="panel skeleton skeleton-card" key={i} />)}
        </section>
      </div>
    </>
  );
}

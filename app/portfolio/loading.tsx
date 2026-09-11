export default function PortfolioLoading() {
  return (
    <div className="content">
      <section className="portfolio-domain-grid">
        {Array.from({ length: 2 }, (_, i) => <div className="panel skeleton skeleton-kpi" key={i} />)}
      </section>
      <div className="panel skeleton skeleton-card" />
      <div className="panel skeleton skeleton-card" />
    </div>
  );
}

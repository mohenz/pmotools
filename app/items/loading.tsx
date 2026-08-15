export default function ItemsLoading() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="skeleton skeleton-title">이슈 관리</h1>
          <p className="skeleton skeleton-line" style={{ width: 220, marginTop: 8 }} />
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

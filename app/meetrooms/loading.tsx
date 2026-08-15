export default function MeetingRoomsLoading() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="skeleton skeleton-title">회의실</h1>
          <p className="skeleton skeleton-line" style={{ width: 220, marginTop: 8 }} />
        </div>
      </header>
      <div className="content">
        <section className="kpi-grid">
          {Array.from({ length: 3 }, (_, i) => <div className="kpi skeleton skeleton-kpi" key={i} />)}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2 className="skeleton skeleton-line" style={{ width: 140 }} />
          </div>
          {Array.from({ length: 5 }, (_, i) => <div className="skeleton skeleton-row" style={{ marginBottom: 8 }} key={i} />)}
        </section>
      </div>
    </>
  );
}

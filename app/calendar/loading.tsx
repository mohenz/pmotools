export default function CalendarLoading() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="skeleton skeleton-title">캘린더</h1>
          <p className="skeleton skeleton-line" style={{ width: 260, marginTop: 8 }} />
        </div>
      </header>
      <div className="content">
        <section className="panel calendar-panel">
          <div className="skeleton skeleton-line" style={{ width: 180, height: 32, marginBottom: 16 }} />
          <div className="calendar-month">
            {Array.from({ length: 35 }, (_, i) => <div className="calendar-cell skeleton" style={{ minHeight: 90 }} key={i} />)}
          </div>
        </section>
      </div>
    </>
  );
}

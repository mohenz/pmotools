import type { UtRunBucket, UtStatRow, UtStats } from "@/lib/server/mp/ut/stats";

const DEFECT_STATUS_ROWS = [{ key: "REGISTERED", label: "등록" }, { key: "FIXED", label: "조치완료" }, { key: "VERIFIED", label: "검증완료" }, { key: "REFIX", label: "재조치" }] as const;
const DEFECT_SEVERITY_COLUMNS = [{ key: "CRITICAL", label: "Critical" }, { key: "MAJOR", label: "Major" }, { key: "MINOR", label: "Minor" }, { key: "TRIVIAL", label: "Trivial" }] as const;

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 1000) / 10}%` : "–");

/** 수행 결과 구성 막대 — 미수행·Pass·Fail·Blocked·N/A 비율(CSS 누적 막대). */
function RunBar({ b }: { b: UtRunBucket }) {
  if (!b.total) return <div className="ut-bar ut-bar-empty" />;
  const seg = (n: number, cls: string, label: string) => n > 0 && <span className={`ut-bar-seg ${cls}`} style={{ width: `${(n / b.total) * 100}%` }} title={`${label} ${n}건`} />;
  return <div className="ut-bar" role="img" aria-label={`Pass ${b.pass}, Fail ${b.fail}, Blocked ${b.blocked}, N/A ${b.na}, 미수행 ${b.none}`}>
    {seg(b.pass, "pass", "Pass")}{seg(b.fail, "fail", "Fail")}{seg(b.blocked, "blocked", "Blocked")}{seg(b.na, "na", "N/A")}{seg(b.none, "none", "미수행")}
  </div>;
}

function StatTable({ title, hint, rows, firstLabel }: { title: string; hint?: string; rows: UtStatRow[]; firstLabel: string }) {
  return <section className="panel">
    <div className="panel-head"><h2>{title}</h2>{hint && <span>{hint}</span>}</div>
    {rows.length ? <div className="table-wrap"><table className="ut-table ut-stat-table">
      <thead><tr><th>{firstLabel}</th><th data-numeric>케이스</th><th data-numeric>수행</th><th data-numeric>미수행</th><th data-numeric>Pass</th><th data-numeric>Fail</th><th data-numeric>Blocked</th><th data-numeric>N/A</th><th data-numeric>수행률</th><th data-numeric>Pass율</th><th className="ut-bar-col">수행결과 구성</th></tr></thead>
      <tbody>{rows.map((r) => {
        const executed = r.total - r.none;
        return <tr key={r.key}>
          <td>{r.label}</td><td data-numeric>{r.total}</td><td data-numeric>{executed}</td><td data-numeric>{r.none}</td><td data-numeric>{r.pass}</td><td data-numeric>{r.fail}</td><td data-numeric>{r.blocked}</td><td data-numeric>{r.na}</td>
          <td data-numeric>{pct(executed, r.total)}</td><td data-numeric>{pct(r.pass, executed)}</td><td className="ut-bar-col"><RunBar b={r} /></td>
        </tr>;
      })}</tbody>
    </table></div> : <div className="empty">집계할 케이스가 없습니다.</div>}
  </section>;
}

// 단위테스트 작성현황·수행결과 통계 화면 — 초안(2026-10-23). 요약 → 수행결과 → 확인 진행 → 결함 → 구분별 표 순서. WBS 트리는 두지 않는다(2026-10-23 사용자 요청).
export function UtStatsScreen({ stats }: { stats: UtStats }) {
  const s = stats.summary;
  const c = stats.confirm;
  const d = stats.defects;
  const kpis: { label: string; value: string; sub?: string; tone?: string }[] = [
    { label: "단위테스트 대상 Task", value: String(s.targetTasks), sub: `케이스 등록 ${s.tasksWithCases}건` },
    { label: "작성률", value: pct(s.tasksWithCases, s.targetTasks), sub: "케이스가 등록된 Task / 대상 Task" },
    { label: "테스트 케이스", value: String(s.caseTotal), sub: `수행 ${s.executed} · 미수행 ${s.notExecuted}` },
    { label: "수행률", value: pct(s.executed, s.caseTotal), sub: "수행 결과가 있는 케이스 / 전체" },
    { label: "Pass율", value: pct(s.pass, s.executed), sub: `Pass ${s.pass} · Fail ${s.fail} · Blocked ${s.blocked} · N/A ${s.na}` },
    { label: "PL 확인 완료", value: String(s.confirmed), sub: `QC 대기 ${c.qcPending} · PL 대기 ${c.plPending}` },
    { label: "미조치 결함", value: String(s.openDefects), sub: "등록 + 조치완료 + 재조치", tone: s.openDefects ? "critical" : undefined },
    { label: "확인 반려", value: String(c.rejected), sub: "최근 차수 기준", tone: c.rejected ? "critical" : undefined },
  ];
  const confirmRows = [
    { step: "수행", state: "결과 없음·확인 대상 아님", count: c.notRequested },
    { step: "QC", state: "확인 대기", count: c.qcPending },
    { step: "PL", state: "확인 대기", count: c.plPending },
    { step: "PL", state: "확인 완료", count: c.confirmed },
    { step: "QC·PL", state: "반려(재수행 대기)", count: c.rejected },
  ];
  return <>
    <header className="topbar"><div><h1>작성현황·수행결과 통계</h1><p>활성 테스트 케이스의 최근 차수 기준 · 초안</p></div></header>
    <div className="content">
      <div className="ut-main">
        <div className="kpi-grid ut-stat-kpis">
          {kpis.map((k) => <div className="kpi" key={k.label}><span>{k.label}</span><strong className={k.tone}>{k.value}</strong>{k.sub && <small>{k.sub}</small>}</div>)}
        </div>

        <section className="panel">
          <div className="panel-head"><h2>수행결과 구성</h2><span>전체 {stats.run.total}건</span></div>
          <RunBar b={stats.run} />
          <ul className="ut-legend">
            <li><i className="ut-bar-seg pass" />Pass {stats.run.pass}</li><li><i className="ut-bar-seg fail" />Fail {stats.run.fail}</li>
            <li><i className="ut-bar-seg blocked" />Blocked {stats.run.blocked}</li><li><i className="ut-bar-seg na" />N/A {stats.run.na}</li><li><i className="ut-bar-seg none" />미수행 {stats.run.none}</li>
          </ul>
        </section>

        <div className="ut-stat-pair">
          <section className="panel">
            <div className="panel-head"><h2>QC·PL 확인 진행</h2><span>최근 차수 기준 · 전체 {stats.run.total}건</span></div>
            <div className="table-wrap"><table className="ut-table ut-stat-table">
              <thead><tr><th>단계</th><th>상태</th><th data-numeric>건수</th><th data-numeric>비율</th></tr></thead>
              <tbody>{confirmRows.map((r) => <tr key={r.step + r.state}><td>{r.step}</td><td>{r.state}</td><td data-numeric>{r.count}</td><td data-numeric>{pct(r.count, stats.run.total)}</td></tr>)}</tbody>
              <tfoot><tr><th colSpan={2}>합계</th><th data-numeric>{stats.run.total}</th><th data-numeric>{stats.run.total ? "100%" : "–"}</th></tr></tfoot>
            </table></div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>결함 현황</h2><span>활성 케이스의 결함 · 상태 × 심각도</span></div>
            <div className="table-wrap"><table className="ut-table ut-stat-table">
              <thead><tr><th>상태</th>{DEFECT_SEVERITY_COLUMNS.map((sv) => <th key={sv.key} data-numeric>{sv.label}</th>)}<th data-numeric>합계</th></tr></thead>
              <tbody>{DEFECT_STATUS_ROWS.map((st) => <tr key={st.key}><td>{st.label}</td>{DEFECT_SEVERITY_COLUMNS.map((sv) => <td key={sv.key} data-numeric>{d[st.key][sv.key]}</td>)}<td data-numeric>{DEFECT_SEVERITY_COLUMNS.reduce((n, sv) => n + d[st.key][sv.key], 0)}</td></tr>)}</tbody>
              <tfoot><tr><th>합계</th>{DEFECT_SEVERITY_COLUMNS.map((sv) => <th key={sv.key} data-numeric>{DEFECT_STATUS_ROWS.reduce((n, st) => n + d[st.key][sv.key], 0)}</th>)}<th data-numeric>{DEFECT_STATUS_ROWS.reduce((n, st) => n + DEFECT_SEVERITY_COLUMNS.reduce((m, sv) => m + d[st.key][sv.key], 0), 0)}</th></tr></tfoot>
            </table></div>
          </section>
        </div>

        <StatTable title="업무단위별" hint="케이스 작성 건수와 수행결과" rows={stats.byGroup} firstLabel="업무단위" />
        <StatTable title="케이스유형별" rows={stats.byType} firstLabel="케이스유형" />
        <StatTable title="수행자별" hint="수행 담당자 기준" rows={stats.byExecutor} firstLabel="수행자" />
      </div>
    </div>
  </>;
}

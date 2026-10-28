// [WBS2 복사본] 원본: screens/WbsDelayHistoryStatsScreen.tsx — 2026-10-28 복사. 원본과 독립 운영(D-1).
import Link from "next/link";
import type { WbsDelayedTaskStats } from "@/lib/server/mp/wbs";
import { WbsDelayHistoryTabs } from "@/components/WbsDelayHistoryTabs";

type Filters = { from?: string; to?: string };

const dt = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const fmt = (value: number) => value.toLocaleString("ko-KR");
const pct = (value: number) => (Number.isFinite(value) ? value.toFixed(1) : "0.0");

export function WbsDelayHistoryStatsScreen({
  stats,
  filters,
  isMp = true,
}: {
  stats: WbsDelayedTaskStats;
  filters: Filters;
  isMp?: boolean;
}) {
  const wbsLinkPrefix = isMp ? "/mp-wbs" : "/wbs";

  return (
    <>
      <header className="topbar">
        <div>
          <h1>지연 이력 통계</h1>
          <p>WBS 실적종료일 지연 등록 현황의 다각도 통계 및 원인 분석 지표입니다.</p>
        </div>
      </header>

      <div className="content">
        <WbsDelayHistoryTabs activeTab="stats" isMp={isMp} filters={filters} />

        <section className="panel compact">
          <form className="filters inline-filter" method="get">
            <div className="filter-row">
              <label>
                시작일
                <input name="from" type="date" defaultValue={filters.from ?? ""} />
              </label>
              <label>
                종료일
                <input name="to" type="date" defaultValue={filters.to ?? ""} />
              </label>
              <button className="button secondary" type="submit">
                조회
              </button>
            </div>
          </form>
        </section>

        <section className="kpi-grid">
          <div className="kpi">
            <span>총 지연 건수</span>
            <strong className={stats.totalCount > 0 ? "critical" : undefined}>
              {fmt(stats.totalCount)}건
            </strong>
            <small>지연 확정 등록 태스크 누적 건수</small>
          </div>
          <div className="kpi">
            <span>누적 지연일수</span>
            <strong className={stats.totalDelayDays > 0 ? "critical" : undefined}>
              {fmt(stats.totalDelayDays)}일
            </strong>
            <small>영업일 기준 총 지연일수 합계</small>
          </div>
          <div className="kpi">
            <span>평균 지연일수</span>
            <strong>{pct(stats.avgDelayDays)}일</strong>
            <small>지연 건당 평균 소요 지연일</small>
          </div>
          <div className="kpi">
            <span>최대 지연일수</span>
            <strong className={stats.maxDelayDays > 14 ? "critical" : undefined}>
              {fmt(stats.maxDelayDays)}일
            </strong>
            <small>최장 지연 Task (단일 기준)</small>
          </div>
        </section>

        {stats.totalCount === 0 ? (
          <section className="panel">
            <div className="empty">조회된 지연 이력 데이터가 없습니다.</div>
          </section>
        ) : (
          <>
            {/* 1. 지연 일수 구간 분포 */}
            <section className="panel">
              <div className="panel-head">
                <h2>지연 일수 구간 분포</h2>
                <span>총 {fmt(stats.totalCount)}건 분석</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>구간 구분</th>
                      <th data-numeric>지연 건수</th>
                      <th data-numeric>누적 지연일수</th>
                      <th data-numeric>건수 비중</th>
                      <th style={{ minWidth: "160px" }}>비중 시각화</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.rangeDistribution.map((item) => (
                      <tr key={item.range}>
                        <td>
                          <span className={`badge ${item.badgeClass}`}>{item.label}</span>
                        </td>
                        <td data-numeric className="mono">
                          {fmt(item.count)}건
                        </td>
                        <td data-numeric className="mono">
                          {fmt(item.totalDays)}일
                        </td>
                        <td data-numeric className="mono">
                          {pct(item.countRate)}%
                        </td>
                        <td>
                          <div
                            style={{
                              background: "var(--muted)",
                              borderRadius: "4px",
                              height: "10px",
                              width: "100%",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(0, item.countRate))}%`,
                                background: "var(--primary)",
                                height: "100%",
                                borderRadius: "4px",
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="totals-row">
                      <td>합계</td>
                      <td data-numeric className="mono">
                        {fmt(stats.totalCount)}건
                      </td>
                      <td data-numeric className="mono">
                        {fmt(stats.totalDelayDays)}일
                      </td>
                      <td data-numeric className="mono">
                        100.0%
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* 2. 업무그룹별 지연 현황 & 담당자별 지연 현황 (2열 배치) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: "16px" }}>
              {/* 2-1. 업무그룹별 통계 */}
              <section className="panel">
                <div className="panel-head">
                  <h2>업무그룹별 지연 현황</h2>
                  <span>{stats.groupStats.length}개 그룹</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>업무그룹</th>
                        <th data-numeric>건수</th>
                        <th data-numeric>비중</th>
                        <th data-numeric>누적일</th>
                        <th data-numeric>평균</th>
                        <th data-numeric>최대</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.groupStats.map((group) => (
                        <tr key={group.groupLabel}>
                          <td><strong>{group.groupLabel}</strong></td>
                          <td data-numeric className="mono">{fmt(group.count)}건</td>
                          <td data-numeric className="mono">{pct(group.countRate)}%</td>
                          <td data-numeric className="mono">{fmt(group.totalDelayDays)}일</td>
                          <td data-numeric className="mono">{pct(group.avgDelayDays)}일</td>
                          <td data-numeric className="mono">
                            <span className="badge issue">{group.maxDelayDays}일</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="totals-row">
                        <td>합계</td>
                        <td data-numeric className="mono">{fmt(stats.totalCount)}건</td>
                        <td data-numeric className="mono">100.0%</td>
                        <td data-numeric className="mono">{fmt(stats.totalDelayDays)}일</td>
                        <td data-numeric className="mono">{pct(stats.avgDelayDays)}일</td>
                        <td data-numeric className="mono">
                          <span className="badge issue">{stats.maxDelayDays}일</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              {/* 2-2. 담당자별 지연 현황 Top 10 */}
              <section className="panel">
                <div className="panel-head">
                  <h2>담당자별 지연 현황 (상위 10명)</h2>
                  <span>총 {stats.affectedOwnersCount}명 중</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>담당자</th>
                        <th>소속 그룹</th>
                        <th data-numeric>건수</th>
                        <th data-numeric>누적일</th>
                        <th data-numeric>평균</th>
                        <th data-numeric>최대</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.ownerStats.map((owner) => (
                        <tr key={owner.ownerName}>
                          <td><strong>{owner.ownerName}</strong></td>
                          <td>{owner.groupLabel}</td>
                          <td data-numeric className="mono">{fmt(owner.count)}건</td>
                          <td data-numeric className="mono">{fmt(owner.totalDelayDays)}일</td>
                          <td data-numeric className="mono">{pct(owner.avgDelayDays)}일</td>
                          <td data-numeric className="mono">
                            <span className="badge issue">{owner.maxDelayDays}일</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* 3. 월별 지연 등록 추이 */}
            {stats.monthlyTrend.length > 0 && (
              <section className="panel">
                <div className="panel-head">
                  <h2>월별 지연 등록 추이</h2>
                  <span>{stats.monthlyTrend.length}개 월</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>등록 월</th>
                        <th data-numeric>지연 건수</th>
                        <th data-numeric>누적 지연일수</th>
                        <th data-numeric>평균 지연일수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.monthlyTrend.map((trend) => (
                        <tr key={trend.month}>
                          <td className="mono"><strong>{trend.month}</strong></td>
                          <td data-numeric className="mono">{fmt(trend.count)}건</td>
                          <td data-numeric className="mono">{fmt(trend.totalDelayDays)}일</td>
                          <td data-numeric className="mono">{pct(trend.avgDelayDays)}일</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 4. 최대 지연 Task Top 5 */}
            {stats.topDelayedTasks.length > 0 && (
              <section className="panel">
                <div className="panel-head">
                  <h2>최대 지연 Task (상위 5건)</h2>
                  <span>지연일수 기준 내림차순</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>업무그룹</th>
                        <th>담당자</th>
                        <th>계획종료일</th>
                        <th>실적종료일</th>
                        <th>지연일수</th>
                        <th>등록일시</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topDelayedTasks.map((task) => (
                        <tr key={task.id}>
                          <td className="title-cell">
                            <Link className="table-link" href={`${wbsLinkPrefix}/${task.wbsItemId}`}>
                              {task.code ? `${task.code} ` : ""}
                              {task.name}
                            </Link>
                          </td>
                          <td>{task.groupLabel ?? "-"}</td>
                          <td>{task.ownerName ?? "-"}</td>
                          <td className="mono">{task.plannedDueDate ?? "-"}</td>
                          <td className="mono">{task.actualDueDate}</td>
                          <td>
                            <span className="badge issue">{task.delayDays}일</span>
                          </td>
                          <td className="mono">{dt(task.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

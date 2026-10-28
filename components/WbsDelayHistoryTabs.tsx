import Link from "next/link";

export function WbsDelayHistoryTabs({
  activeTab,
  isMp = false,
  filters,
}: {
  activeTab: "list" | "stats";
  isMp?: boolean;
  filters?: { from?: string; to?: string; pageSize?: number | "all" };
}) {
  const prefix = isMp ? "/mp-wbs/delay-history" : "/wbs/delay-history";
  const params = new URLSearchParams();
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  if (filters?.pageSize && filters.pageSize !== 20) params.set("pageSize", String(filters.pageSize));
  const qs = params.toString() ? `?${params.toString()}` : "";

  return (
    <section className="panel compact" style={{ padding: "0 16px", minHeight: "44px", display: "flex", alignItems: "stretch", marginBottom: "16px" }}>
      <nav className="tool-tabs" aria-label="지연 이력 탭">
        <Link
          className={activeTab === "list" ? "active" : ""}
          href={`${prefix}${qs}`}
          aria-current={activeTab === "list" ? "page" : undefined}
        >
          지연 이력 목록
        </Link>
        <Link
          className={activeTab === "stats" ? "active" : ""}
          href={`${prefix}/stats${qs}`}
          aria-current={activeTab === "stats" ? "page" : undefined}
        >
          지연 이력 통계
        </Link>
      </nav>
    </section>
  );
}

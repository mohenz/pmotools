import Link from "next/link";
import type { SearchResultGroup } from "@/lib/server/search";

export function SearchResultsScreen({ query, groups }: { query: string; groups: SearchResultGroup[] }) {
  const totalCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  return <>
    <header className="topbar"><div><h1>검색 결과</h1><p>{query ? <>&ldquo;{query}&rdquo; 검색 · 총 {totalCount}건</> : "검색어를 2자 이상 입력해주세요."}</p></div></header>
    <div className="content">
      {query.length >= 2 && groups.length === 0 && <div className="empty">일치하는 결과가 없습니다.</div>}
      {groups.map((group) => <section className="panel" key={group.type}>
        <div className="panel-head"><h2>{group.label}</h2><span>{group.items.length}건</span></div>
        <ul className="search-result-list">
          {group.items.map((item) => <li key={item.id}>
            <Link className="table-link" href={item.href}>{item.title}</Link>
            <small>{item.meta}</small>
            {item.snippet && <p>{item.snippet}</p>}
          </li>)}
        </ul>
      </section>)}
    </div>
  </>;
}

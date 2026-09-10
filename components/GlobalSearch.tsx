"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { SearchResultGroup } from "@/lib/server/search";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setGroups([]); setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/v1/search?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((body) => setGroups(body.data.groups))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function goToFullResults() {
    const q = query.trim();
    if (q.length < 2) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  const hasResults = groups.some((group) => group.items.length > 0);

  return (
    <div className="global-search" ref={containerRef}>
      <div className="global-search-input">
        <Search aria-hidden="true" />
        <input
          type="search"
          placeholder="검색"
          value={query}
          aria-label="전체 검색"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); goToFullResults(); } if (e.key === "Escape") setOpen(false); }}
        />
      </div>
      {open && query.trim().length >= 2 && (
        <div className="global-search-results">
          {loading && <p className="global-search-status">검색 중…</p>}
          {!loading && !hasResults && <p className="global-search-status">일치하는 결과가 없습니다.</p>}
          {!loading && groups.map((group) => (
            <div className="global-search-group" key={group.type}>
              <h3>{group.label}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} onClick={() => setOpen(false)}>
                      <span className="global-search-item-title">{item.title}</span>
                      <span className="global-search-item-meta">{item.meta}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!loading && <button type="button" className="global-search-more" onClick={goToFullResults}>전체 결과 보기</button>}
        </div>
      )}
    </div>
  );
}

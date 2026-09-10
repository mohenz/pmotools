import { getLocalContext } from "@/lib/server/context";
import { searchAll } from "@/lib/server/search";
import { SearchResultsScreen } from "@/screens/SearchResultsScreen";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { projectId } = await getLocalContext();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const groups = query.length >= 2 ? await searchAll(projectId, query, 30) : [];
  return <SearchResultsScreen query={query} groups={groups} />;
}

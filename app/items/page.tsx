import { getLocalContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { listItems } from "@/lib/server/items";
import { ItemListScreen } from "@/screens/ItemListScreen";

export const dynamic = "force-dynamic";

export default async function ItemsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = {
    q: typeof params.q === "string" ? params.q : "",
    kind: typeof params.kind === "string" ? params.kind : "",
    status: typeof params.status === "string" ? params.status : "",
    category: typeof params.category === "string" ? params.category : "",
    probability: typeof params.probability === "string" ? params.probability : "",
    impact: typeof params.impact === "string" ? params.impact : "",
    open: params.open === "true",
    stale: params.stale === "true",
    page: typeof params.page === "string" ? Number(params.page) || 1 : 1,
  };
  const { projectId } = getLocalContext();
  const [result, options] = await Promise.all([listItems(projectId, filters), getCodeOptions(projectId)]);
  return <ItemListScreen result={result} filters={filters} options={options} />;
}

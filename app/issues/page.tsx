import { requirePmPmoContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { listIssues } from "@/lib/server/issues";
import { IssueListScreen } from "@/screens/IssueListScreen";

export const dynamic = "force-dynamic";

export default async function IssuesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = {
    q: typeof params.q === "string" ? params.q : "",
    categoryCodeId: typeof params.categoryCodeId === "string" ? params.categoryCodeId : "",
    status: typeof params.status === "string" ? params.status : "",
    importance: typeof params.importance === "string" ? params.importance : "",
    priority: typeof params.priority === "string" ? params.priority : "",
    escalated: params.escalated === "true" ? true : params.escalated === "false" ? false : undefined,
    page: typeof params.page === "string" ? Number(params.page) || 1 : 1,
  };
  const { projectId } = await requirePmPmoContext();
  const [result, options] = await Promise.all([listIssues(projectId, filters), getCodeOptions(projectId)]);
  const displayFilters = { ...filters, escalated: params.escalated === "true" ? "true" : params.escalated === "false" ? "false" : "" };
  return <IssueListScreen result={result} filters={displayFilters} options={{ issueTypes: options.issueTypes }} />;
}

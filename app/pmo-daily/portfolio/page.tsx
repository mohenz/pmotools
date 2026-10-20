import { requirePmPmoContext } from "@/lib/server/context";
import { getProjectPortfolio } from "@/lib/server/project-portfolio";
import { ProjectPortfolioScreen } from "@/screens/ProjectPortfolioScreen";

export const dynamic = "force-dynamic";

export default async function ProjectPortfolioPage() {
  const { projectId } = await requirePmPmoContext();
  return <ProjectPortfolioScreen data={await getProjectPortfolio(projectId)} />;
}

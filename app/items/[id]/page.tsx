import { notFound } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { getItemDetail } from "@/lib/server/items";
import { ItemDetailScreen } from "@/screens/ItemDetailScreen";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId } = await getLocalContext();
  const [detail, options] = await Promise.all([getItemDetail(projectId, id), getCodeOptions(projectId)]);
  if (!detail) notFound();
  return <ItemDetailScreen detail={detail} options={options} />;
}

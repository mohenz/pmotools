import { getLocalContext } from "@/lib/server/context";
import { getMyProfile } from "@/lib/server/users";
import { MyProfileScreen } from "@/screens/MyProfileScreen";

export const dynamic = "force-dynamic";

export default async function MyProfilePage() {
  const { projectId, userId } = await getLocalContext();
  const profile = await getMyProfile(projectId, userId);
  return <MyProfileScreen profile={profile} />;
}

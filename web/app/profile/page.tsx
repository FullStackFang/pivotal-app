import { listUserFiles } from "@/lib/data/userFiles";
import { ProfileView } from "@/components/ProfileView";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const files = listUserFiles();
  return <ProfileView initialFiles={files} />;
}

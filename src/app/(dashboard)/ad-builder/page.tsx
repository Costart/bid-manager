import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdBuilderApp from "@/components/ad-builder/AdBuilderApp";

export default async function AdBuilderPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <AdBuilderApp />;
}

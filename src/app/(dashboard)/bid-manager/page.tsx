import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BidManagerClient } from "@/components/bid-manager/BidManagerClient";

export const metadata = { title: "Bid Manager" };

export default async function BidManagerPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bid Manager</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload Google Ads data, calculate optimal bids, and export to Microsoft Ads.
        </p>
      </div>
      <BidManagerClient />
    </div>
  );
}

import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Welcome!</h2>
          <p className="text-gray-600 mb-4">
            You are signed in as{" "}
            <span className="font-medium">{session.user.email}</span>
          </p>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Ad Builder
          </h2>
          <p className="text-gray-600 mb-4">
            Analyze website structure with AI, generate campaign hierarchies,
            RSA ad copy, and export or push directly to Google Ads.
          </p>
          <Link href="/ad-builder">
            <Button variant="primary">Open Ad Builder</Button>
          </Link>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Microsoft Bidder
          </h2>
          <p className="text-gray-600 mb-4">
            Pull converting search terms from Google Ads and push to Microsoft
            Ads with optimized bids.
          </p>
          <Link href="/search-terms">
            <Button variant="primary">Open Microsoft Bidder</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}

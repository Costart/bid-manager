import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SearchTermOptimizer from "@/components/search-terms/SearchTermOptimizer";

export const metadata = { title: "Microsoft Bidder" };

export default async function SearchTermsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Microsoft Bidder</h1>
        <p className="mt-1 text-sm text-gray-600">
          Pull converting search terms from Google Ads and push to Microsoft Ads
          with optimized bids.
        </p>
      </div>
      <SearchTermOptimizer />
    </div>
  );
}

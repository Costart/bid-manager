import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Bid Manager</h1>
        <p className="text-gray-600 mb-8">
          Upload Google Ads data. Calculate optimal bids. Export to Microsoft
          Ads.
        </p>
        <Link href="/login">
          <Button variant="primary" className="w-full sm:w-auto">
            Sign In
          </Button>
        </Link>
      </Card>
    </div>
  );
}

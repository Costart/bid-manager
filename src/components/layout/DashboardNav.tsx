"use client";

import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export function DashboardNav() {
  const { data: session } = useSession();

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-bold text-gray-900">
              PPC Tools
            </Link>
            <Link
              href="/ad-builder"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Ad Builder
            </Link>
            <Link
              href="/search-terms"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Microsoft Bidder
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {session?.user && (
              <span className="text-sm text-gray-600">
                {session.user.email}
              </span>
            )}
            <Button
              variant="secondary"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

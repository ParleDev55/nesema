"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PractitionerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm w-full text-center">
        <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-10 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-nesema-sage-p flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4E7A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-nesema-t1 mb-2">Something went wrong</h1>
          <p className="text-sm text-nesema-t2 mb-6 leading-relaxed">
            We couldn&apos;t load this page. Try again or head back to your dashboard.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={reset}
              className="w-full px-5 py-2.5 bg-nesema-sage text-white text-sm rounded-full hover:bg-nesema-sage-l transition-colors"
            >
              Try again
            </button>
            <Link
              href="/practitioner/dashboard"
              className="w-full px-5 py-2.5 border border-nesema-bdr text-sm text-nesema-t2 rounded-full hover:bg-nesema-bg transition-colors"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

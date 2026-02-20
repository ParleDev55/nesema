"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-screen bg-[#F6F3EE] flex items-center justify-center p-6 font-sans antialiased">
        <div className="max-w-md w-full text-center">
          <p className="font-serif text-4xl text-[#2E2620] mb-2">Nesema</p>
          <div className="bg-white rounded-2xl border border-[#E6E0D8] p-10 mt-8 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[#EBF2EE] flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4E7A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-[#1E1A16] mb-2">Something went wrong</h1>
            <p className="text-sm text-[#5C5248] mb-8 leading-relaxed">
              We ran into an unexpected problem. Please try again — if this keeps happening, reach out to support.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={reset}
                className="w-full px-6 py-2.5 bg-[#4E7A5F] text-white text-sm font-medium rounded-full hover:bg-[#6B9E7A] transition-colors"
              >
                Try again
              </button>
              <Link
                href="/"
                className="w-full px-6 py-2.5 border border-[#E6E0D8] text-sm text-[#5C5248] rounded-full hover:bg-[#F6F3EE] transition-colors"
              >
                Go home
              </Link>
            </div>
          </div>
          <p className="mt-6 text-xs text-[#9C9087]">Health, felt whole.</p>
        </div>
      </body>
    </html>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <Skeleton className="h-8 w-40" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5 space-y-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5 space-y-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>

      {/* Secondary charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

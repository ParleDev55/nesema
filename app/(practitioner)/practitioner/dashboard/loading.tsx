import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5 space-y-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Two column layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Today's sessions */}
        <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5 space-y-4">
          <Skeleton className="h-5 w-36" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>

        {/* Patient alerts */}
        <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function PatientProfileLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-xl" />
        ))}
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>

      {/* Check-in rows */}
      <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <div className="flex gap-2 flex-1">
              {[...Array(5)].map((__, j) => (
                <Skeleton key={j} className="h-7 w-7 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

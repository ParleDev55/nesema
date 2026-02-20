import { Skeleton } from "@/components/ui/skeleton";

export default function PaymentsLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>

      {/* Revenue stats */}
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Invoice rows */}
      <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr divide-y divide-nesema-bdr">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

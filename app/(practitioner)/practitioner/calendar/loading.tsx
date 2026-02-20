import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5 space-y-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        {/* Weeks */}
        {[...Array(5)].map((_, w) => (
          <div key={w} className="grid grid-cols-7 gap-2">
            {[...Array(7)].map((_, d) => (
              <Skeleton key={d} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

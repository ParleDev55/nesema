import { Skeleton } from "@/components/ui/skeleton";

export default function CheckInLoading() {
  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-52" />
      </div>

      {/* Mood */}
      <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5 space-y-4">
        <Skeleton className="h-5 w-24" />
        <div className="flex gap-3 justify-center">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-12 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Sliders */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5 space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
      ))}

      {/* Notes */}
      <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5 space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>

      <Skeleton className="h-11 w-full rounded-full" />
    </div>
  );
}

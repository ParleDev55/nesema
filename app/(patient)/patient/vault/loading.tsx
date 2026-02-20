import { Skeleton } from "@/components/ui/skeleton";

export default function VaultLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-52" />
      </div>

      {/* PIN prompt skeleton */}
      <div className="max-w-sm mx-auto bg-nesema-surf rounded-2xl border border-nesema-bdr p-8 space-y-6 text-center">
        <Skeleton className="h-16 w-16 rounded-full mx-auto" />
        <Skeleton className="h-6 w-40 mx-auto" />
        <Skeleton className="h-4 w-56 mx-auto" />
        <div className="flex gap-3 justify-center">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-12 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

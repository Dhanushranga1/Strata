import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function TicketListSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header with search and filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <Skeleton className="h-10 w-full sm:w-96" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Table Header */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b p-4">
            <div className="flex gap-4">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-48 ml-auto" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>

          {/* Table Rows */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="border-b p-4 last:border-b-0">
              <div className="flex gap-4 items-center">
                <Skeleton className="h-5 w-5" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pagination Skeleton */}
      <div className="flex justify-center gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

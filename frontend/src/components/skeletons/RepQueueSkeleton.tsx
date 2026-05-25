import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function RepQueueSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-10 w-32" />
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Skeleton className="h-10 w-full sm:w-96" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Ticket Cards */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
              <div className="flex gap-2 mt-4">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center items-center gap-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { cn } from '@/lib/utils';
import { Button } from './button';
import { Input } from './input';
import { Badge } from './badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import {
  Search,
  Filter,
  Download,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';
import { forwardRef, useState, useMemo } from 'react';

interface Column<T = any> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (props: { row: { original: T }; value?: any }) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface FilterConfig {
  [key: string]: string;
}

interface ActionItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'ghost' | 'destructive';
  onClick: (row: any) => void;
}

interface DataTableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  filterable?: boolean;
  sortable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  selectable?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
  actions?: ActionItem[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
  variant?: 'default' | 'compact' | 'bordered';
}

const DataTable = forwardRef<HTMLDivElement, DataTableProps>(
  (
    {
      data,
      columns,
      searchable = true,
      searchPlaceholder = 'Search...',
      filterable = false,
      sortable = true,
      pagination = true,
      pageSize = 10,
      selectable = false,
      onSelectionChange,
      actions = [],
      onRowClick,
      emptyMessage = 'No data available',
      loading = false,
      className,
      variant = 'default',
      ...props
    },
    ref
  ) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [filters, setFilters] = useState<FilterConfig>({});
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

    // Default actions
    const defaultActions: ActionItem[] = [
      {
        id: 'view',
        label: 'View',
        icon: Eye,
        onClick: row => console.log('View:', row),
      },
      {
        id: 'edit',
        label: 'Edit',
        icon: Edit,
        onClick: row => console.log('Edit:', row),
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        variant: 'destructive',
        onClick: row => console.log('Delete:', row),
      },
    ];

    const allActions = actions.length > 0 ? actions : defaultActions;

    // Memoized filtered and sorted data
    const processedData = useMemo(() => {
      let result = [...data];

      // Apply search
      if (searchQuery) {
        result = result.filter(row =>
          columns.some(column => {
            if (column.accessorKey) {
              const value = row[column.accessorKey];
              return String(value)
                .toLowerCase()
                .includes(searchQuery.toLowerCase());
            }
            return false;
          })
        );
      }

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          result = result.filter(row => {
            const rowValue = row[key as keyof typeof row];
            return String(rowValue).toLowerCase().includes(value.toLowerCase());
          });
        }
      });

      // Apply sorting
      if (sortConfig) {
        result.sort((a, b) => {
          const aValue = a[sortConfig.key as keyof typeof a];
          const bValue = b[sortConfig.key as keyof typeof b];

          if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        });
      }

      return result;
    }, [data, searchQuery, filters, sortConfig, columns]);

    // Pagination
    const totalPages = Math.ceil(processedData.length / pageSize);
    const paginatedData = pagination
      ? processedData.slice(
          (currentPage - 1) * pageSize,
          currentPage * pageSize
        )
      : processedData;

    const handleSort = (columnId: string) => {
      if (!sortable) return;

      setSortConfig(current => {
        if (current?.key === columnId) {
          if (current.direction === 'asc') {
            return { key: columnId, direction: 'desc' };
          } else {
            return null; // Remove sorting
          }
        }
        return { key: columnId, direction: 'asc' };
      });
    };

    const handleRowSelection = (index: number, checked: boolean) => {
      const newSelection = new Set(selectedRows);
      if (checked) {
        newSelection.add(index);
      } else {
        newSelection.delete(index);
      }
      setSelectedRows(newSelection);

      const selectedData = Array.from(newSelection).map(i => processedData[i]);
      onSelectionChange?.(selectedData);
    };

    const handleSelectAll = (checked: boolean) => {
      if (checked) {
        const allIndices = new Set(paginatedData.map((_, index) => index));
        setSelectedRows(allIndices);
        onSelectionChange?.(paginatedData);
      } else {
        setSelectedRows(new Set());
        onSelectionChange?.([]);
      }
    };

    const getSortIcon = (columnId: string) => {
      if (!sortConfig || sortConfig.key !== columnId) {
        return <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />;
      }
      return sortConfig.direction === 'asc' ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      );
    };

    const tableVariants = {
      default: '',
      compact: 'text-sm',
      bordered: 'border',
    };

    return (
      <div ref={ref} className={cn('space-y-4', className)} {...props}>
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            {searchable && (
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            {filterable && (
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            )}

            {selectedRows.size > 0 && (
              <Badge variant="secondary">{selectedRows.size} selected</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table className={cn(tableVariants[variant])}>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={
                        selectedRows.size === paginatedData.length &&
                        paginatedData.length > 0
                      }
                      onChange={e => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300"
                      aria-label="Select all rows"
                    />
                  </TableHead>
                )}
                {columns.map(column => (
                  <TableHead
                    key={column.id}
                    className={cn(
                      column.width && `w-[${column.width}]`,
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      column.sortable && 'cursor-pointer hover:bg-muted/50'
                    )}
                    onClick={() => column.sortable && handleSort(column.id)}
                  >
                    <div className="flex items-center gap-2">
                      {column.header}
                      {column.sortable && getSortIcon(column.id)}
                    </div>
                  </TableHead>
                ))}
                {allActions.length > 0 && (
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                // Loading skeleton
                Array.from({ length: pageSize }).map((_, index) => (
                  <TableRow key={index}>
                    {selectable && (
                      <TableCell>
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </TableCell>
                    )}
                    {columns.map(column => (
                      <TableCell key={column.id}>
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </TableCell>
                    ))}
                    {allActions.length > 0 && (
                      <TableCell>
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={
                      columns.length +
                      (selectable ? 1 : 0) +
                      (allActions.length > 0 ? 1 : 0)
                    }
                    className="h-24 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, index) => (
                  <TableRow
                    key={index}
                    className={cn(
                      onRowClick && 'cursor-pointer hover:bg-muted/50',
                      selectedRows.has(index) && 'bg-muted/30'
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(index)}
                          onChange={e => {
                            e.stopPropagation();
                            handleRowSelection(index, e.target.checked);
                          }}
                          className="rounded border-gray-300"
                          aria-label={`Select row ${index + 1}`}
                        />
                      </TableCell>
                    )}
                    {columns.map(column => (
                      <TableCell
                        key={column.id}
                        className={cn(
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right'
                        )}
                      >
                        {column.cell
                          ? column.cell({
                              row: { original: row },
                              value: column.accessorKey
                                ? row[column.accessorKey]
                                : undefined,
                            })
                          : column.accessorKey
                            ? String(row[column.accessorKey] || '')
                            : ''}
                      </TableCell>
                    ))}
                    {allActions.length > 0 && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {allActions.slice(0, 2).map(action => {
                            const IconComponent = action.icon;
                            return (
                              <Button
                                key={action.id}
                                variant={action.variant || 'ghost'}
                                size="sm"
                                onClick={e => {
                                  e.stopPropagation();
                                  action.onClick(row);
                                }}
                                className="h-8 w-8 p-0"
                              >
                                {IconComponent && (
                                  <IconComponent className="h-4 w-4" />
                                )}
                              </Button>
                            );
                          })}
                          {allActions.length > 2 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, processedData.length)} of{' '}
              {processedData.length} results
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage(prev => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
);
DataTable.displayName = 'DataTable';

export { DataTable, type Column, type ActionItem };

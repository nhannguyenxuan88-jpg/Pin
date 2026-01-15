import React, { useState } from "react";
import { cn } from "../../lib/utils/cn";

export interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({ children, className }) => {
  return (
    <div className="overflow-x-auto rounded-lg border border-pin-gray-200 dark:border-pin-dark-300 bg-white dark:bg-pin-dark-200">
      <table className={cn("w-full", className)}>{children}</table>
    </div>
  );
};

export interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ children, className }) => {
  return (
    <thead
      className={cn(
        "bg-pin-gray-50 dark:bg-pin-dark-100",
        "border-b border-pin-gray-200 dark:border-pin-dark-300",
        className
      )}
    >
      {children}
    </thead>
  );
};

export interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const TableBody: React.FC<TableBodyProps> = ({ children, className }) => {
  return <tbody className={className}>{children}</tbody>;
};

export interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  className,
  onClick,
  selected = false,
}) => {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-pin-gray-200 dark:border-pin-dark-300",
        "transition-colors duration-150",
        onClick && "cursor-pointer",
        selected
          ? "bg-pin-blue-50 dark:bg-pin-blue-900/20"
          : "hover:bg-pin-gray-50 dark:hover:bg-pin-dark-100",
        className
      )}
    >
      {children}
    </tr>
  );
};

export interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  sortable?: boolean;
  sorted?: "asc" | "desc" | null;
  onSort?: () => void;
  align?: "left" | "center" | "right";
}

export const TableHead: React.FC<TableHeadProps> = ({
  children,
  className,
  style,
  sortable = false,
  sorted = null,
  onSort,
  align = "left",
}) => {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  const justifyClasses = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  };

  return (
    <th
      className={cn(
        "px-6 py-4",
        alignClasses[align],
        "text-xs font-semibold",
        "text-pin-gray-600 dark:text-pin-dark-600",
        "uppercase tracking-wider",
        sortable && "cursor-pointer select-none hover:bg-pin-gray-100 dark:hover:bg-pin-dark-200",
        className
      )}
      onClick={sortable ? onSort : undefined}
      style={style}
    >
      <div className={cn("flex items-center gap-2", justifyClasses[align])}>
        <span>{children}</span>
        {sortable && (
          <span className="flex flex-col">
            <svg
              className={cn(
                "w-3 h-3 -mb-1",
                sorted === "asc" ? "text-pin-blue-500" : "text-pin-gray-400 dark:text-pin-dark-500"
              )}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" />
            </svg>
            <svg
              className={cn(
                "w-3 h-3",
                sorted === "desc" ? "text-pin-blue-500" : "text-pin-gray-400 dark:text-pin-dark-500"
              )}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" />
            </svg>
          </span>
        )}
      </div>
    </th>
  );
};

export interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

export const TableCell: React.FC<TableCellProps> = ({ children, className, align = "left" }) => {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <td
      className={cn(
        "px-6 py-4",
        "text-sm text-pin-gray-900 dark:text-pin-dark-900",
        alignClasses[align],
        className
      )}
    >
      {children}
    </td>
  );
};

// Advanced Table with built-in features
export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  render?: (item: T, index: number) => React.ReactNode;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  onRowClick?: (item: T, index: number) => void;
  selectedRows?: Set<string | number>;
  emptyMessage?: string;
  className?: string;
  loading?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  selectedRows,
  emptyMessage = "Không có dữ liệu",
  className,
  loading = false,
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const handleSort = (columnKey: string) => {
    setSortConfig((current) => {
      if (current?.key === columnKey) {
        if (current.direction === "asc") {
          return { key: columnKey, direction: "desc" };
        }
        return null;
      }
      return { key: columnKey, direction: "asc" };
    });
  };

  const sortedData = React.useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aValue = (a as any)[sortConfig.key];
      const bValue = (b as any)[sortConfig.key];

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [data, sortConfig]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white dark:bg-pin-dark-200 rounded-lg border border-pin-gray-200 dark:border-pin-dark-300">
        <div className="text-center">
          <svg
            className="animate-spin w-8 h-8 text-pin-blue-500 mx-auto mb-2"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-sm text-pin-gray-500 dark:text-pin-dark-500">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-white dark:bg-pin-dark-200 rounded-lg border border-pin-gray-200 dark:border-pin-dark-300">
        <div className="text-center">
          <svg
            className="w-12 h-12 text-pin-gray-400 dark:text-pin-dark-500 mx-auto mb-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-pin-gray-500 dark:text-pin-dark-500">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.key}
              align={column.align}
              sortable={column.sortable}
              sorted={sortConfig?.key === column.key ? sortConfig.direction : null}
              onSort={column.sortable ? () => handleSort(column.key) : undefined}
              style={column.width ? { width: column.width } : undefined}
            >
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedData.map((item, index) => {
          const key = keyExtractor(item, index);
          const isSelected = selectedRows?.has(key);

          return (
            <TableRow key={key} onClick={() => onRowClick?.(item, index)} selected={isSelected}>
              {columns.map((column) => (
                <TableCell key={column.key} align={column.align}>
                  {column.render
                    ? column.render(item, index)
                    : String((item as any)[column.key] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

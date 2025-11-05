import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  totalItems: number;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, itemsPerPage, totalItems }) => {
  if (totalPages <= 1) {
    return null;
  }

  const pageNumbers: (number | string)[] = [];
  const maxPagesToShow = 5;
  const halfMaxPages = Math.floor(maxPagesToShow / 2);

  if (totalPages <= maxPagesToShow + 2) {
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    if (currentPage <= halfMaxPages + 1) {
      for (let i = 1; i <= maxPagesToShow; i++) {
        pageNumbers.push(i);
      }
      pageNumbers.push('...');
      pageNumbers.push(totalPages);
    } else if (currentPage >= totalPages - halfMaxPages) {
      pageNumbers.push(1);
      pageNumbers.push('...');
      for (let i = totalPages - maxPagesToShow + 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1);
      pageNumbers.push('...');
      for (let i = currentPage - (halfMaxPages - 1); i <= currentPage + (halfMaxPages - 1); i++) {
        pageNumbers.push(i);
      }
      pageNumbers.push('...');
      pageNumbers.push(totalPages);
    }
  }
  
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(startIndex + itemsPerPage - 1, totalItems);


  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mt-6 text-sm text-slate-600 dark:text-slate-400">
        <div className="mb-2 sm:mb-0">
            Hiển thị <strong>{startIndex}</strong>-<strong>{endIndex}</strong> trên <strong>{totalItems}</strong> kết quả
        </div>
        <div className="flex items-center space-x-1">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                aria-label="Trang trước"
            >
                &laquo;
            </button>
            {pageNumbers.map((num, index) => (
                <React.Fragment key={index}>
                {num === '...' ? (
                    <span className="px-3 py-1.5">...</span>
                ) : (
                    <button
                    onClick={() => onPageChange(num as number)}
                    className={`px-3 py-1.5 border rounded-md ${
                        currentPage === num
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                    aria-label={`Trang ${num}`}
                    aria-current={currentPage === num ? 'page' : undefined}
                    >
                    {num}
                    </button>
                )}
                </React.Fragment>
            ))}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                aria-label="Trang sau"
            >
                &raquo;
            </button>
        </div>
    </div>
  );
};

export default Pagination;
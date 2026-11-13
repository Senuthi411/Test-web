import { pageCount } from '@/shared/utilities/pagination'
import styles from './DataTable.module.css'

export interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  /** Noun for the summary, e.g. "demo users" → "Showing 1–13 of 13 demo users". */
  itemLabel: string
}

export function Pagination({ page, pageSize, total, onPageChange, itemLabel }: PaginationProps) {
  const pages = pageCount(total, pageSize)
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <p className={styles.paginationSummary} aria-live="polite">
        Showing {first}–{last} of {total} {itemLabel}
      </p>
      <div className={styles.pages}>
        <button
          type="button"
          className={styles.pageButton}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          ‹
        </button>
        {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
          <button
            key={number}
            type="button"
            className={styles.pageButton}
            aria-current={number === page ? 'page' : undefined}
            aria-label={`Page ${number}`}
            onClick={() => onPageChange(number)}
          >
            {number}
          </button>
        ))}
        <button
          type="button"
          className={styles.pageButton}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </nav>
  )
}

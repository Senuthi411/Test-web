import { CSV_MIME } from '../../application/csv'

/** Saves a CSV string as a file in the browser (presentation only: uses Blob, URL and the DOM). */
export function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: CSV_MIME }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

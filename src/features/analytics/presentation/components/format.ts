/** "21 Oct 2026" in Sri Lanka time. */
export const formatDate = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' })

/** "10:00" in Sri Lanka time. */
export const formatTime = (value: string) => new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })

export const observationPath = (id: string, tab = '') => `/observations/${encodeURIComponent(id)}${tab ? `/${tab}` : ''}`
export const dateTime = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' }).format(new Date(value))
export const failure = (error: unknown) => error instanceof Error ? error.message : 'The operation failed. Please try again.'

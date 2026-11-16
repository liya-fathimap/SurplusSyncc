export function formatQuantities(items = []) {
  if (!items.length) return '0'
  return items
    .map(({ quantity, unit }) => `${Number(quantity).toLocaleString()} ${unit}`)
    .join(' · ')
}

export function formatDate(value, options = {}) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(date)
}

export function getReservedQuantity(listing) {
  return Math.max(0, Number(listing?.quantity || 0) - Number(listing?.availableQuantity || 0))
}

export function getListingState(listing) {
  if (listing.collectionDeadline && new Date(listing.collectionDeadline) <= new Date() &&
    ['available', 'partially_reserved', 'fully_reserved'].includes(listing.status)) {
    return 'expired'
  }
  return listing.status
}

export function formatLabel(value = '') {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

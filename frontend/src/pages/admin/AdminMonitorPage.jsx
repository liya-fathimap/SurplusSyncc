import { useCallback, useEffect, useState } from 'react'
import { Activity, ClipboardList, PackageSearch, Truck } from 'lucide-react'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import { getAdminApiError, getAdminMonitor } from '../../services/adminService.js'
import { formatDate, formatLabel } from '../../utils/providerFormat.js'

const configs = {
  listings: {
    title: 'Food listing monitoring',
    eyebrow: 'Inventory oversight',
    description: 'Inspect food listings and provider status across the platform.',
    icon: PackageSearch,
    resultKey: 'listings',
    filters: [{ name: 'status', label: 'Status', options: ['draft', 'available', 'partially_reserved', 'fully_reserved', 'expired', 'cancelled'] }],
    columns: ['Listing', 'Provider', 'Quantity', 'Deadline', 'Status'],
  },
  reservations: {
    title: 'Reservation monitoring',
    eyebrow: 'Reservation oversight',
    description: 'Track reservation decisions, quantities, and the organizations involved.',
    icon: ClipboardList,
    resultKey: 'reservations',
    filters: [{ name: 'status', label: 'Status', options: ['pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'failed'] }],
    columns: ['Food listing', 'NGO', 'Requested / approved', 'Requested', 'Status'],
  },
  deliveries: {
    title: 'Delivery monitoring',
    eyebrow: 'Logistics oversight',
    description: 'Monitor volunteer assignments and delivery status transitions.',
    icon: Truck,
    resultKey: 'deliveries',
    filters: [{ name: 'status', label: 'Status', options: ['pending', 'assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'] }],
    columns: ['Food listing', 'Volunteer', 'NGO', 'Created', 'Status'],
  },
  'activity-logs': {
    title: 'Activity logs',
    eyebrow: 'Audit trail',
    description: 'Review operational actions recorded by the backend activity log.',
    icon: Activity,
    resultKey: 'activityLogs',
    filters: [{ name: 'entityType', label: 'Entity type', options: ['User', 'FoodListing', 'Reservation', 'Delivery', 'Notification'] }],
    columns: ['Action', 'Actor', 'Entity', 'Recorded'],
  },
}

function getRowValues(kind, record) {
  if (kind === 'listings') {
    return [
      <span><strong>{record.title}</strong><small>{record.foodCategory}</small></span>,
      record.provider?.organizationName || record.provider?.name || 'Provider',
      `${record.availableQuantity} / ${record.quantity} ${record.unit}`,
      formatDate(record.collectionDeadline),
      <span className={`provider-status status-${record.status}`}>{formatLabel(record.status)}</span>,
    ]
  }
  if (kind === 'reservations') {
    return [
      <span><strong>{record.foodListing?.title || 'Listing unavailable'}</strong><small>{record.foodListing?.foodCategory}</small></span>,
      record.ngo?.organizationName || record.ngo?.name || 'NGO',
      `${record.requestedQuantity} / ${record.approvedQuantity ?? '—'} ${record.foodListing?.unit || ''}`,
      formatDate(record.requestedAt),
      <span className={`provider-status status-${record.status}`}>{formatLabel(record.status)}</span>,
    ]
  }
  if (kind === 'deliveries') {
    const reservation = record.reservation
    return [
      reservation?.foodListing?.title || 'Listing unavailable',
      record.volunteer?.name || 'Unassigned',
      reservation?.ngo?.organizationName || reservation?.ngo?.name || 'NGO',
      formatDate(record.createdAt),
      <span className={`provider-status status-${record.status}`}>{formatLabel(record.status)}</span>,
    ]
  }
  return [
    <span><strong>{formatLabel(record.action)}</strong><small>{record.details ? JSON.stringify(record.details) : ''}</small></span>,
    record.actor?.name || 'Unknown actor',
    `${record.entityType} · ${String(record.entityId || '').slice(-8)}`,
    formatDate(record.createdAt),
  ]
}

function AdminMonitorPage({ kind }) {
  const config = configs[kind]
  const Icon = config.icon
  const [records, setRecords] = useState([])
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const result = await getAdminMonitor(kind, {
        page,
        limit: 15,
        ...filters,
      })
      setRecords(result[config.resultKey] || [])
      setPagination(result.pagination || { total: 0, totalPages: 0 })
      setError('')
    } catch (requestError) {
      setError(getAdminApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [config.resultKey, filters, kind, page])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  return (
    <div className="provider-page admin-page">
      <ProviderPageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} />
      <Card className="provider-panel">
        <div className="provider-panel-heading">
          <div><span className="provider-panel-kicker">Platform records</span><h2><Icon aria-hidden="true" /> {config.title}</h2></div>
          <div className="admin-filter-row">
            {config.filters.map((filter) => (
              <label className="admin-filter" key={filter.name}>
                <span className="sr-only">{filter.label}</span>
                <select
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, [filter.name]: event.target.value }))
                    setPage(1)
                    setLoading(true)
                  }}
                  value={filters[filter.name] || ''}
                >
                  <option value="">All {filter.label.toLowerCase()}s</option>
                  {filter.options.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
        {error ? (
          <ProviderState type="error" title="Platform records unavailable" description={error} onRetry={() => { setLoading(true); void Promise.resolve().then(load) }} />
        ) : loading ? (
          <div className="provider-loading"><Loading label={`Loading ${config.title.toLowerCase()}…`} /></div>
        ) : records.length ? (
          <>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record._id}>
                      {getRowValues(kind, record).map((value, index) => <td key={`${record._id}-${config.columns[index]}`}>{value}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="provider-pagination">
              <span>{pagination.total} records · Page {page} of {Math.max(pagination.totalPages, 1)}</span>
              <div>
                <button className="button button-secondary button-small" disabled={page <= 1} onClick={() => { setPage((value) => value - 1); setLoading(true) }} type="button">Previous</button>
                <button className="button button-secondary button-small" disabled={page >= pagination.totalPages} onClick={() => { setPage((value) => value + 1); setLoading(true) }} type="button">Next</button>
              </div>
            </div>
          </>
        ) : (
          <ProviderState title={`No ${kind.replace('-', ' ')} records`} description="Records will appear here when the platform has matching activity." />
        )}
      </Card>
    </div>
  )
}

export default AdminMonitorPage

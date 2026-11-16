import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import useRealtimeEvent from '../../hooks/useRealtimeEvent.js'
import { getNgoApiError, getNgoReservations } from '../../services/ngoService.js'
import { formatDate, formatLabel } from '../../utils/providerFormat.js'

const pageSize = 10

function ReservationsPage() {
  const [reservations, setReservations] = useState([])
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const result = await getNgoReservations({
        page,
        limit: pageSize,
        ...(status ? { status } : {}),
      })
      setReservations(result.reservations || [])
      setPagination(result.pagination || { total: 0, totalPages: 0 })
      setError('')
    } catch (requestError) {
      setError(getNgoApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useRealtimeEvent('reservation:updated', () => { void load() })

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  function changeStatus(event) {
    setLoading(true)
    setPage(1)
    setStatus(event.target.value)
  }

  return (
    <div className="provider-page">
      <ProviderPageHeader
        eyebrow="Your activity"
        title="My reservations"
        description="Review provider decisions, reserved quantities, and collection progress."
      />
      <Card className="provider-panel ngo-reservations-panel">
        <div className="provider-panel-heading">
          <div><span className="provider-panel-kicker">Reservation history</span><h2><ClipboardList aria-hidden="true" /> Requests and collections</h2></div>
          <label className="ngo-status-filter">
            <span className="sr-only">Filter reservations by status</span>
            <select onChange={changeStatus} value={status}>
              <option value="">All statuses</option>
              {['pending', 'confirmed', 'completed', 'rejected', 'cancelled', 'failed'].map((value) => (
                <option key={value} value={value}>{formatLabel(value)}</option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <ProviderState type="error" title="Reservations could not be loaded" description={error} onRetry={() => {
            setLoading(true)
            void Promise.resolve().then(load)
          }} />
        ) : loading ? (
          <div className="provider-loading"><Loading label="Loading your reservations…" /></div>
        ) : reservations.length ? (
          <>
            <div className="provider-list">
              {reservations.map((reservation) => (
                <Link
                  className="provider-list-row ngo-reservation-row"
                  key={reservation._id}
                  to={`/ngo/reservations/${reservation._id}`}
                >
                  <span className="provider-list-icon"><ClipboardList aria-hidden="true" /></span>
                  <span className="provider-list-main">
                    <strong>{reservation.foodListing?.title || 'Food reservation'}</strong>
                    <small>{reservation.requestedQuantity} {reservation.foodListing?.unit} requested · {formatDate(reservation.requestedAt)}</small>
                  </span>
                  {reservation.approvedQuantity != null && (
                    <span className="provider-list-amount">{reservation.approvedQuantity} {reservation.foodListing?.unit}<small>approved</small></span>
                  )}
                  <span className={`provider-status status-${reservation.status}`}>{formatLabel(reservation.status)}</span>
                </Link>
              ))}
            </div>
            <div className="provider-pagination">
              <span>{pagination.total} reservation{pagination.total === 1 ? '' : 's'} · Page {page} of {Math.max(pagination.totalPages, 1)}</span>
              <div>
                <button
                  aria-label="Previous page"
                  className="button button-secondary button-small"
                  disabled={page <= 1}
                  onClick={() => { setLoading(true); setPage((current) => current - 1) }}
                  type="button"
                ><ArrowLeft aria-hidden="true" /></button>
                <button
                  aria-label="Next page"
                  className="button button-secondary button-small"
                  disabled={page >= pagination.totalPages}
                  onClick={() => { setLoading(true); setPage((current) => current + 1) }}
                  type="button"
                ><ArrowRight aria-hidden="true" /></button>
              </div>
            </div>
          </>
        ) : (
          <ProviderState
            title={status ? `No ${formatLabel(status).toLowerCase()} reservations` : 'No reservations yet'}
            description="When you request food, your reservation and collection status will appear here."
          />
        )}
      </Card>
    </div>
  )
}

export default ReservationsPage

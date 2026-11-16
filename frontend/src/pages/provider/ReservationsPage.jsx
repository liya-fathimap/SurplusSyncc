import { useCallback, useEffect, useState } from 'react'
import { Check, ClipboardList, X } from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import {
  confirmProviderReservation,
  getProviderApiError,
  getProviderReservations,
  rejectProviderReservation,
} from '../../services/providerService.js'
import { formatDate, formatLabel } from '../../utils/providerFormat.js'

const reservationFilters = [
  ['all', 'All requests'],
  ['pending', 'Pending'],
  ['confirmed', 'Confirmed'],
  ['rejected', 'Rejected'],
  ['cancelled', 'Cancelled'],
  ['completed', 'Completed'],
  ['failed', 'Failed'],
]

function ReservationsPage() {
  const [reservations, setReservations] = useState([])
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [approvedQuantities, setApprovedQuantities] = useState({})
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const result = await getProviderReservations({
        page: 1,
        limit: 100,
        ...(status !== 'all' ? { status } : {}),
      })
      setReservations(result.reservations || [])
    } catch (requestError) {
      setError(getProviderApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load, reloadKey])

  async function handleConfirm(reservation) {
    setBusyId(reservation._id)
    setActionError('')
    try {
      const quantity = Number(approvedQuantities[reservation._id] ?? reservation.requestedQuantity)
      await confirmProviderReservation(reservation._id, quantity)
      await load()
    } catch (requestError) {
      setActionError(getProviderApiError(requestError))
    } finally {
      setBusyId('')
    }
  }

  async function handleReject(reservationId) {
    setBusyId(reservationId)
    setActionError('')
    try {
      await rejectProviderReservation(reservationId)
      await load()
    } catch (requestError) {
      setActionError(getProviderApiError(requestError))
    } finally {
      setBusyId('')
    }
  }

  function changeStatus(event) {
    setLoading(true)
    setError('')
    setStatus(event.target.value)
  }

  function retry() {
    setLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="provider-page">
      <ProviderPageHeader
        eyebrow="Reservation management"
        title="Incoming reservations"
        description="Review requests from NGOs and community kitchens, then confirm an approved quantity or reject the request."
      />
      {actionError && <div className="provider-alert" role="alert">{actionError}</div>}
      <div className="provider-toolbar">
        <label className="provider-filter">
          <span>Request status</span>
          <select onChange={changeStatus} value={status}>
            {reservationFilters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <Card className="provider-panel">
        {loading ? (
          <div className="provider-loading"><Loading label="Loading reservation requests…" /></div>
        ) : error ? (
          <ProviderState type="error" description={error} onRetry={retry} />
        ) : reservations.length ? (
          <div className="provider-reservation-list">
            {reservations.map((reservation) => {
              const listing = reservation.foodListing
              const unit = listing?.unit || ''
              const available = Number(listing?.availableQuantity || 0)
              const approved = approvedQuantities[reservation._id] ?? reservation.requestedQuantity
              return (
                <article className="provider-reservation-card" key={reservation._id}>
                  <div className="provider-reservation-heading">
                    <span className="provider-list-icon"><ClipboardList aria-hidden="true" /></span>
                    <div className="provider-list-main">
                      <strong>{reservation.ngo?.organizationName || reservation.ngo?.name || 'Organization request'}</strong>
                      <small>{listing?.title || 'Listing unavailable'} · Requested {formatDate(reservation.requestedAt)}</small>
                    </div>
                    <span className={`provider-status status-${reservation.status}`}>{formatLabel(reservation.status)}</span>
                  </div>
                  <div className="provider-reservation-meta">
                    <span><small>Requested</small><strong>{reservation.requestedQuantity} {unit}</strong></span>
                    <span><small>Available now</small><strong>{available} {unit}</strong></span>
                    <span><small>Collection method</small><strong>{formatLabel(reservation.collectionMethod)}</strong></span>
                    <span><small>Deadline</small><strong>{formatDate(listing?.collectionDeadline)}</strong></span>
                  </div>
                  {reservation.ngo?.isVerified === false && (
                    <p className="provider-info-note">This NGO is not currently marked verified. The backend will enforce eligibility when confirming.</p>
                  )}
                  {reservation.status === 'pending' && (
                    <div className="provider-reservation-actions">
                      <label className="provider-field provider-approve-quantity">
                        <span>Approve quantity ({unit})</span>
                        <input
                          max={Math.min(Number(reservation.requestedQuantity), available)}
                          min="0.01"
                          onChange={(event) => setApprovedQuantities((current) => ({
                            ...current,
                            [reservation._id]: event.target.value,
                          }))}
                          step="any"
                          type="number"
                          value={approved}
                        />
                      </label>
                      <div className="provider-inline-actions">
                        <Button
                          disabled={busyId === reservation._id || available <= 0}
                          onClick={() => handleConfirm(reservation)}
                          size="small"
                        >
                          <Check aria-hidden="true" /> Confirm
                        </Button>
                        <Button
                          disabled={busyId === reservation._id}
                          onClick={() => handleReject(reservation._id)}
                          size="small"
                          variant="secondary"
                        >
                          <X aria-hidden="true" /> Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <ProviderState
            title={status === 'pending' ? 'No pending requests' : 'No reservations found'}
            description="Reservation requests linked to your food listings will appear here."
          />
        )}
      </Card>
    </div>
  )
}

export default ReservationsPage

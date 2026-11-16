import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CalendarClock, MapPin, PackageCheck, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import Modal from '../../components/common/Modal.jsx'
import NGODeliveryCard from '../../components/ngo/NGODeliveryCard.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import useRealtimeEvent from '../../hooks/useRealtimeEvent.js'
import {
  cancelNgoReservation,
  getNgoApiError,
  getNgoDeliveries,
  getNgoReservation,
} from '../../services/ngoService.js'
import { formatDate, formatLabel } from '../../utils/providerFormat.js'

function ReservationDetailsPage() {
  const { reservationId } = useParams()
  const routeLocation = useLocation()
  const [reservation, setReservation] = useState(null)
  const [delivery, setDelivery] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deliveryError, setDeliveryError] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    const [reservationResult, deliveryResult] = await Promise.allSettled([
      getNgoReservation(reservationId),
      getNgoDeliveries(),
    ])
    if (reservationResult.status === 'fulfilled') {
      setReservation(reservationResult.value.reservation)
      setError('')
    } else {
      setError(getNgoApiError(reservationResult.reason))
    }
    if (deliveryResult.status === 'fulfilled') {
      const found = (deliveryResult.value.deliveries || [])
        .find((item) => String(item.reservation?._id) === String(reservationId))
      setDelivery(found || null)
      setDeliveryError('')
    } else {
      setDeliveryError(getNgoApiError(deliveryResult.reason))
    }
    setLoading(false)
  }, [reservationId])

  useRealtimeEvent('reservation:updated', () => { void load() })
  useRealtimeEvent('delivery:updated', () => { void load() })

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  async function cancelReservation() {
    setCancelBusy(true)
    setActionError('')
    try {
      await cancelNgoReservation(reservationId)
      setCancelOpen(false)
      await load()
    } catch (requestError) {
      setActionError(getNgoApiError(requestError))
    } finally {
      setCancelBusy(false)
    }
  }

  async function refresh() {
    setLoading(true)
    await load()
  }

  if (loading) {
    return <div className="provider-loading"><Loading label="Loading reservation details…" /></div>
  }
  if (error || !reservation) {
    return (
      <div className="provider-page">
        <ProviderState
          type="error"
          title="Reservation unavailable"
          description={error || 'This reservation could not be found.'}
          action={<Button to="/ngo/reservations" size="small" variant="secondary">Back to reservations</Button>}
        />
      </div>
    )
  }

  const listing = reservation.foodListing
  const isCancelable = ['pending', 'confirmed'].includes(reservation.status) &&
    !['picked_up', 'in_transit', 'delivered'].includes(delivery?.status)

  return (
    <div className="provider-page">
      <Link className="provider-back-link" to="/ngo/reservations"><ArrowLeft aria-hidden="true" /> Back to reservations</Link>
      <ProviderPageHeader
        eyebrow="Reservation details"
        title={listing?.title || 'Food reservation'}
        description={`Requested ${formatDate(reservation.requestedAt)} · Provider: ${listing?.provider?.organizationName || listing?.provider?.name || 'Food provider'}`}
        actions={<span className={`provider-status status-${reservation.status}`}>{formatLabel(reservation.status)}</span>}
      />

      {routeLocation.state?.notice && (
        <div className="provider-success" role="status">{routeLocation.state.notice}</div>
      )}
      {actionError && <div className="provider-alert" role="alert">{actionError}</div>}

      <div className="provider-dashboard-grid">
        <Card className="provider-panel">
          <div className="provider-panel-heading"><h2>Reservation summary</h2></div>
          <div className="provider-detail-stats">
            <div><small>Requested quantity</small><strong>{reservation.requestedQuantity} {listing?.unit}</strong></div>
            <div><small>Approved quantity</small><strong>{reservation.approvedQuantity == null ? 'Awaiting provider' : `${reservation.approvedQuantity} ${listing?.unit}`}</strong></div>
            <div><small>Collection method</small><strong>{formatLabel(reservation.collectionMethod)}</strong></div>
            <div><small>Last updated</small><strong>{formatDate(reservation.updatedAt)}</strong></div>
          </div>
          <div className="provider-detail-list">
            <p><PackageCheck aria-hidden="true" /><span><small>Category and quantity</small>{listing?.foodCategory || 'Food'} · {listing?.availableQuantity ?? '—'} {listing?.unit} currently available</span></p>
            <p><CalendarClock aria-hidden="true" /><span><small>Collection deadline</small>{formatDate(listing?.collectionDeadline)}</span></p>
            <p><MapPin aria-hidden="true" /><span><small>Pickup address</small>{listing?.pickupAddress || 'Address provided by the food provider'}</span></p>
            <p><ShieldCheck aria-hidden="true" /><span><small>Allergens</small>{listing?.allergens?.length ? listing.allergens.join(', ') : 'Not specified'}</span></p>
          </div>
          {reservation.status === 'rejected' && reservation.rejectionReason && (
            <div className="provider-info-note"><strong>Provider response:</strong> {reservation.rejectionReason}</div>
          )}
          {isCancelable && (
            <div className="provider-form-actions">
              <Button onClick={() => setCancelOpen(true)} variant="danger">Cancel reservation</Button>
            </div>
          )}
          {!isCancelable && ['picked_up', 'in_transit', 'delivered'].includes(delivery?.status) && (
            <p className="provider-field-help">This reservation can no longer be cancelled after pickup. Contact support if there is a delivery issue.</p>
          )}
        </Card>

        <Card className="provider-panel">
          <div className="provider-panel-heading"><h2>Provider instructions</h2></div>
          {reservation.status === 'pending' && (
            <ProviderState title="Waiting for provider confirmation" description="Your request does not allocate food until the provider confirms the quantity." />
          )}
          {reservation.status === 'confirmed' && deliveryError && (
            <ProviderState type="error" title="Collection details unavailable" description={deliveryError} onRetry={refresh} />
          )}
          {reservation.status === 'confirmed' && !deliveryError && !delivery && (
            <ProviderState title="Collection record is being prepared" description="Refresh this page in a moment to see pickup or delivery details." onRetry={refresh} />
          )}
          {delivery && <NGODeliveryCard delivery={delivery} onUpdated={refresh} />}
          {['rejected', 'cancelled', 'failed'].includes(reservation.status) && (
            <p className="provider-field-help">This reservation is {formatLabel(reservation.status).toLowerCase()}. Browse available food to make another request.</p>
          )}
          {reservation.status === 'completed' && !delivery && (
            <div className="provider-success">Collection complete. Thank you for preventing food waste.</div>
          )}
        </Card>
      </div>

      <Modal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this reservation?"
      >
        <p className="provider-modal-copy">The provider will be notified. If this reservation was confirmed, its quantity will be returned to available stock unless pickup has started.</p>
        <div className="provider-form-actions">
          <Button disabled={cancelBusy} onClick={() => setCancelOpen(false)} variant="secondary">Keep reservation</Button>
          <Button disabled={cancelBusy} onClick={cancelReservation} variant="danger">{cancelBusy ? 'Cancelling…' : 'Confirm cancellation'}</Button>
        </div>
      </Modal>
    </div>
  )
}

export default ReservationDetailsPage

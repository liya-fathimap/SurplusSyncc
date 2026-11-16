import { useState } from 'react'
import { CheckCircle2, KeyRound, MapPin, Truck } from 'lucide-react'
import Button from '../common/Button.jsx'
import Card from '../common/Card.jsx'
import {
  getNgoApiError,
  requestVerificationQr,
  verifyNgoDelivery,
} from '../../services/ngoService.js'
import { formatDate, formatLabel } from '../../utils/providerFormat.js'

function getCodeFromQrInput(value, deliveryId) {
  const input = value.trim()
  if (/^[a-f\d]{64}$/i.test(input)) return input
  try {
    const payload = JSON.parse(input)
    if (
      payload.type === 'surplussync.delivery-verification' &&
      String(payload.deliveryId) === String(deliveryId) &&
      payload.stage === 'delivery' &&
      /^[a-f\d]{64}$/i.test(payload.code)
    ) {
      return payload.code
    }
  } catch {
    return null
  }
  return null
}

function NGODeliveryCard({ delivery, onUpdated }) {
  const reservation = delivery.reservation
  const listing = reservation?.foodListing
  const [pickupQr, setPickupQr] = useState(null)
  const [deliveryCode, setDeliveryCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  async function generatePickupQr() {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const result = await requestVerificationQr(delivery._id, 'pickup')
      setPickupQr(result)
    } catch (requestError) {
      setError(getNgoApiError(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelivery(event) {
    event.preventDefault()
    const code = getCodeFromQrInput(deliveryCode, delivery._id)
    if (!code) {
      setError('Paste the delivery QR contents or its 64-character verification code.')
      return
    }
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await verifyNgoDelivery(delivery._id, code)
      setDeliveryCode('')
      setSuccess('Delivery confirmed. The reservation is now complete.')
      await onUpdated()
    } catch (requestError) {
      setError(getNgoApiError(requestError))
    } finally {
      setBusy(false)
    }
  }

  const canIssueSelfPickupQr =
    delivery.collectionMethod === 'self_pickup' &&
    delivery.status === 'pending' &&
    reservation?.status === 'confirmed'

  return (
    <Card className="ngo-delivery-card">
      <div className="provider-pickup-heading">
        <span className="provider-list-icon"><Truck aria-hidden="true" /></span>
        <div className="provider-list-main">
          <strong>{listing?.title || 'Reserved food'}</strong>
          <small>{reservation?.approvedQuantity} {listing?.unit} · {formatLabel(delivery.collectionMethod)}</small>
        </div>
        <span className={`provider-status status-${delivery.status}`}>{formatLabel(delivery.status)}</span>
      </div>

      <div className="provider-reservation-meta">
        <span><small>Provider</small><strong>{listing?.provider?.organizationName || listing?.provider?.name || 'Food provider'}</strong></span>
        <span><small>Volunteer</small><strong>{delivery.volunteer?.name || 'Not assigned'}</strong></span>
        <span><small>Pickup address</small><strong>{listing?.pickupAddress || '—'}</strong></span>
        <span><small>Collection deadline</small><strong>{formatDate(listing?.collectionDeadline)}</strong></span>
      </div>

      {listing?.pickupAddress && (
        <a
          className="ngo-map-directions"
          href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(listing.pickupAddress)}`}
          rel="noreferrer"
          target="_blank"
        >
          <MapPin aria-hidden="true" /> Open address in OpenStreetMap
        </a>
      )}

      {canIssueSelfPickupQr && (
        <div className="ngo-delivery-action">
          <p>Generate a one-time pickup QR code for the provider to verify when you collect the food.</p>
          <Button disabled={busy} onClick={generatePickupQr} size="small">
            <KeyRound aria-hidden="true" /> {pickupQr ? 'Regenerate pickup QR' : 'Generate pickup QR'}
          </Button>
          {pickupQr && (
            <div className="ngo-verification-qr">
              <img alt="One-time pickup verification QR code" src={pickupQr.qrCode} />
              <div>
                <strong>Show this code to the provider</strong>
                <p>Keep this one-time code private until pickup.</p>
                <output>{pickupQr.verificationCode}</output>
              </div>
            </div>
          )}
        </div>
      )}

      {delivery.collectionMethod === 'volunteer_delivery' && delivery.status === 'in_transit' && (
        <form className="ngo-delivery-action ngo-delivery-confirm-form" onSubmit={confirmDelivery}>
          <p>The delivery is in transit. Confirm receipt using the delivery QR code provided by your volunteer.</p>
          <label className="provider-field">
            <span><KeyRound aria-hidden="true" /> Delivery verification code or QR contents</span>
            <textarea
              autoComplete="off"
              onChange={(event) => setDeliveryCode(event.target.value)}
              placeholder="Paste the 64-character code or QR JSON"
              rows="2"
              spellCheck="false"
              value={deliveryCode}
            />
          </label>
          <Button disabled={busy} type="submit"><CheckCircle2 aria-hidden="true" /> Confirm delivery received</Button>
        </form>
      )}

      {['delivered', 'picked_up'].includes(delivery.status) && (
        <div className="provider-success">
          {delivery.status === 'delivered'
            ? `Delivery verified${delivery.deliveredAt ? ` on ${formatDate(delivery.deliveredAt)}` : ''}.`
            : `Pickup verified${delivery.pickupTime ? ` on ${formatDate(delivery.pickupTime)}` : ''}.`}
        </div>
      )}

      {error && <div className="provider-alert" role="alert">{error}</div>}
      {success && <div className="provider-success" role="status">{success}</div>}
    </Card>
  )
}

export default NGODeliveryCard

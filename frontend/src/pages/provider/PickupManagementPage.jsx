import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, Truck } from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import {
  getProviderApiError,
  getProviderDeliveries,
  verifyProviderPickup,
} from '../../services/providerService.js'
import { formatDate, formatLabel } from '../../utils/providerFormat.js'

function readPickupCode(input, deliveryId) {
  const value = input.trim()
  if (/^[a-f\d]{64}$/i.test(value)) return value

  try {
    const payload = JSON.parse(value)
    if (
      payload.type === 'surplussync.delivery-verification' &&
      String(payload.deliveryId) === String(deliveryId) &&
      payload.stage === 'pickup' &&
      /^[a-f\d]{64}$/i.test(payload.code)
    ) {
      return payload.code
    }
  } catch {
    return null
  }
  return null
}

function PickupManagementPage() {
  const [deliveries, setDeliveries] = useState([])
  const [codes, setCodes] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const [busyId, setBusyId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const result = await getProviderDeliveries()
      setDeliveries(result.deliveries || [])
    } catch (requestError) {
      setError(getProviderApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load, reloadKey])

  function refresh() {
    setLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  async function handleVerify(deliveryId) {
    const code = readPickupCode(codes[deliveryId] || '', deliveryId)
    if (!code) {
      setActionError('Enter the 64-character verification code or paste the pickup QR data for this delivery.')
      return
    }
    setBusyId(deliveryId)
    setActionError('')
    setSuccess('')
    try {
      await verifyProviderPickup(deliveryId, code)
      setCodes((current) => ({ ...current, [deliveryId]: '' }))
      setSuccess('Pickup verified. The delivery status has been updated.')
      await load()
    } catch (requestError) {
      setActionError(getProviderApiError(requestError))
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="provider-page">
      <ProviderPageHeader
        eyebrow="Pickup and delivery"
        title="Pickup management"
        description="Review confirmed collections and verify pickup codes supplied by the collecting NGO or volunteer."
        actions={<Button onClick={refresh} variant="secondary"><Truck aria-hidden="true" /> Refresh</Button>}
      />
      {actionError && <div className="provider-alert" role="alert">{actionError}</div>}
      {success && <div className="provider-success" role="status">{success}</div>}

      <Card className="provider-panel">
        {loading ? (
          <div className="provider-loading"><Loading label="Loading pickup records…" /></div>
        ) : error ? (
          <ProviderState type="error" description={error} onRetry={refresh} />
        ) : deliveries.length ? (
          <div className="provider-pickup-list">
            {deliveries.map((delivery) => {
              const reservation = delivery.reservation
              const listing = reservation?.foodListing
              const pickupAvailable = ['pending', 'accepted'].includes(delivery.status)
              return (
                <article className="provider-pickup-card" key={delivery._id}>
                  <div className="provider-pickup-heading">
                    <span className="provider-list-icon"><Truck aria-hidden="true" /></span>
                    <div className="provider-list-main">
                      <strong>{listing?.title || 'Food listing'}</strong>
                      <small>{reservation?.approvedQuantity} {listing?.unit} · {formatLabel(delivery.collectionMethod)}</small>
                    </div>
                    <span className={`provider-status status-${delivery.status}`}>{formatLabel(delivery.status)}</span>
                  </div>
                  <div className="provider-reservation-meta">
                    <span><small>NGO</small><strong>{reservation?.ngo?.organizationName || reservation?.ngo?.name || '—'}</strong></span>
                    <span><small>Volunteer</small><strong>{delivery.volunteer?.name || (delivery.collectionMethod === 'self_pickup' ? 'Self pickup' : 'Not assigned')}</strong></span>
                    <span><small>Pickup address</small><strong>{listing?.pickupAddress || '—'}</strong></span>
                    <span><small>Deadline</small><strong>{formatDate(listing?.collectionDeadline)}</strong></span>
                  </div>
                  {pickupAvailable ? (
                    <div className="provider-verify-row">
                      <label className="provider-field">
                        <span><KeyRound aria-hidden="true" /> Pickup verification code</span>
                        <input
                          autoComplete="off"
                          onChange={(event) => setCodes((current) => ({ ...current, [delivery._id]: event.target.value }))}
                          placeholder="Paste code or QR payload from the NGO / volunteer"
                          spellCheck="false"
                          value={codes[delivery._id] || ''}
                        />
                      </label>
                      <Button disabled={busyId === delivery._id} onClick={() => handleVerify(delivery._id)}>
                        <CheckCircle2 aria-hidden="true" /> Verify pickup
                      </Button>
                    </div>
                  ) : (
                    <p className="provider-field-help">
                      Pickup verification is unavailable for this status. Current state: {formatLabel(delivery.status)}.
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <ProviderState
            title="No confirmed pickups yet"
            description="Once you confirm an NGO reservation, its pickup and delivery record will show here."
          />
        )}
      </Card>
    </div>
  )
}

export default PickupManagementPage

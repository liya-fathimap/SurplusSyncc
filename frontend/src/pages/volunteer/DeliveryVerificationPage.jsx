import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, QrCode, RefreshCw, Truck } from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import useRealtimeEvent from '../../hooks/useRealtimeEvent.js'
import VolunteerPageHeader from '../../components/volunteer/VolunteerPageHeader.jsx'
import { formatLabel } from '../../utils/providerFormat.js'
import {
  getVolunteerApiError,
  getVolunteerDeliveries,
  markVolunteerDeliveryInTransit,
  requestVolunteerVerificationQr,
} from '../../services/volunteerService.js'

function DeliveryVerificationPage() {
  const [deliveries, setDeliveries] = useState([])
  const [qrById, setQrById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const result = await getVolunteerDeliveries()
      setDeliveries((result.deliveries || []).filter((delivery) => (
        ['accepted', 'picked_up', 'in_transit'].includes(delivery.status)
      )))
      setError('')
    } catch (requestError) {
      setError(getVolunteerApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useRealtimeEvent('delivery:updated', () => { void load() })

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load, reloadKey])

  async function generateQr(deliveryId, stage) {
    const key = `${deliveryId}:${stage}`
    setBusyKey(key)
    setActionError('')
    setSuccess('')
    try {
      const result = await requestVolunteerVerificationQr(deliveryId, stage)
      setQrById((current) => ({ ...current, [key]: result }))
    } catch (requestError) {
      setActionError(getVolunteerApiError(requestError))
    } finally {
      setBusyKey('')
    }
  }

  async function markInTransit(deliveryId) {
    setBusyKey(`${deliveryId}:transit`)
    setActionError('')
    setSuccess('')
    try {
      await markVolunteerDeliveryInTransit(deliveryId)
      setQrById((current) => {
        const next = { ...current }
        delete next[`${deliveryId}:pickup`]
        return next
      })
      setSuccess('Delivery marked in transit. Refresh after the organization confirms receipt.')
      setLoading(true)
      setReloadKey((key) => key + 1)
    } catch (requestError) {
      setActionError(getVolunteerApiError(requestError))
    } finally {
      setBusyKey('')
    }
  }

  function refresh() {
    setLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="provider-page volunteer-page">
      <VolunteerPageHeader
        title="Pickup & delivery verification"
        description="Show a one-time pickup QR to the provider, then mark the handoff in transit. The receiving organization verifies the delivery QR at drop-off."
        actions={<Button onClick={refresh} variant="secondary"><RefreshCw aria-hidden="true" /> Refresh status</Button>}
      />
      {actionError && <div className="provider-alert" role="alert">{actionError}</div>}
      {success && <div className="provider-success" role="status">{success}</div>}
      <Card className="provider-panel">
        {loading ? (
          <div className="provider-loading"><Loading label="Loading delivery verification status…" /></div>
        ) : error ? (
          <ProviderState type="error" title="Verification records are unavailable" description={error} onRetry={refresh} />
        ) : deliveries.length ? (
          <div className="volunteer-verify-list">
            {deliveries.map((delivery) => {
              const listing = delivery.reservation?.foodListing
              const pickupKey = `${delivery._id}:pickup`
              const deliveryKey = `${delivery._id}:delivery`
              const pickupQr = qrById[pickupKey]
              const deliveryQr = qrById[deliveryKey]
              return (
                <article className="volunteer-verify-card" key={delivery._id}>
                  <div className="volunteer-verify-heading">
                    <div><span className="provider-panel-kicker">{listing?.title || 'Food delivery'}</span><h2>{delivery.reservation?.ngo?.organizationName || delivery.reservation?.ngo?.name || 'Receiving organization'}</h2></div>
                    <span className={`provider-status status-${delivery.status}`}>{formatLabel(delivery.status)}</span>
                  </div>
                  {delivery.status === 'accepted' && (
                    <div className="volunteer-step">
                      <div className="volunteer-step-copy"><h3><KeyRound aria-hidden="true" /> Provider pickup check</h3><p>Generate and present the pickup QR code to the provider. The provider scans it to verify the handoff.</p></div>
                      <Button disabled={busyKey === pickupKey} onClick={() => generateQr(delivery._id, 'pickup')} variant="secondary">
                        <QrCode aria-hidden="true" /> {busyKey === pickupKey ? 'Generating…' : pickupQr ? 'Regenerate pickup QR' : 'Show pickup QR'}
                      </Button>
                      {pickupQr?.qrCode && <div className="volunteer-qr"><img alt="One-time pickup verification QR code" src={pickupQr.qrCode} /><span>Pickup code · show this image to the provider</span></div>}
                    </div>
                  )}
                  {delivery.status === 'picked_up' && (
                    <div className="volunteer-step">
                      <div className="volunteer-step-copy"><h3><Truck aria-hidden="true" /> Food collected</h3><p>After confirming you have the food, mark this delivery in transit. The organization will verify it on arrival.</p></div>
                      <Button disabled={busyKey === `${delivery._id}:transit`} onClick={() => markInTransit(delivery._id)}>
                        <CheckCircle2 aria-hidden="true" /> {busyKey === `${delivery._id}:transit` ? 'Updating…' : 'Mark in transit'}
                      </Button>
                    </div>
                  )}
                  {delivery.status === 'in_transit' && (
                    <div className="volunteer-step">
                      <div className="volunteer-step-copy"><h3><KeyRound aria-hidden="true" /> Organization delivery check</h3><p>At the drop-off, present this QR code to the organization so they can verify receipt.</p></div>
                      <Button disabled={busyKey === deliveryKey} onClick={() => generateQr(delivery._id, 'delivery')} variant="secondary">
                        <QrCode aria-hidden="true" /> {busyKey === deliveryKey ? 'Generating…' : deliveryQr ? 'Regenerate delivery QR' : 'Show delivery QR'}
                      </Button>
                      {deliveryQr?.qrCode && <div className="volunteer-qr"><img alt="One-time delivery verification QR code" src={deliveryQr.qrCode} /><span>Delivery code · show this image to the organization</span></div>}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <ProviderState title="No deliveries need verification" description="Accept a task to begin. Pickup QR codes become available after acceptance." />
        )}
      </Card>
      <p className="provider-info-note volunteer-security-note">Verification codes are one-time and are generated by the authorized delivery API. Do not share QR images except with the provider or receiving organization at the relevant handoff.</p>
    </div>
  )
}

export default DeliveryVerificationPage

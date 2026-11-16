import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Clock3, MapPin, Package, Truck, UserRound } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import VolunteerRouteMap from '../../components/volunteer/VolunteerRouteMap.jsx'
import VolunteerPageHeader from '../../components/volunteer/VolunteerPageHeader.jsx'
import { acceptVolunteerTask, failVolunteerDelivery, getVolunteerApiError, getVolunteerAvailableTasks, getVolunteerDeliveries } from '../../services/volunteerService.js'
import { formatDate, formatLabel } from '../../utils/providerFormat.js'

function TaskDetailsPage() {
  const { taskId } = useParams()
  const [delivery, setDelivery] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [failureReason, setFailureReason] = useState('')
  const [failureError, setFailureError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const [availableResult, assignedResult] = await Promise.all([
        getVolunteerAvailableTasks(),
        getVolunteerDeliveries(),
      ])
      const tasks = [...(availableResult.deliveries || []), ...(assignedResult.deliveries || [])]
      setDelivery(tasks.find((item) => String(item._id) === String(taskId)) || null)
      setError('')
    } catch (requestError) {
      setError(getVolunteerApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load, reloadKey])

  async function acceptTask() {
    setBusy(true)
    setActionError('')
    try {
      await acceptVolunteerTask(taskId)
      setReloadKey((key) => key + 1)
      setLoading(true)
    } catch (requestError) {
      setActionError(getVolunteerApiError(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function reportFailure(event) {
    event.preventDefault()
    const reason = failureReason.trim()
    if (!reason || reason.length > 500) {
      setFailureError('Enter a brief reason of up to 500 characters.')
      return
    }

    setBusy(true)
    setFailureError('')
    setActionError('')
    try {
      await failVolunteerDelivery(taskId, reason)
      setFailureReason('')
      setLoading(true)
      setReloadKey((key) => key + 1)
    } catch (requestError) {
      setFailureError(getVolunteerApiError(requestError))
    } finally {
      setBusy(false)
    }
  }

  const reservation = delivery?.reservation
  const listing = reservation?.foodListing
  const ngo = reservation?.ngo
  const canAccept = delivery?.status === 'pending'

  return (
    <div className="provider-page volunteer-page">
      <VolunteerPageHeader
        title="Delivery task details"
        description="Review the pickup and destination information before you take on this delivery."
        actions={<Button to="/volunteer/tasks" variant="secondary"><ArrowLeft aria-hidden="true" /> All tasks</Button>}
      />
      {actionError && <div className="provider-alert" role="alert">{actionError}</div>}
      {loading ? (
        <div className="provider-loading"><Loading label="Loading delivery details…" /></div>
      ) : error ? (
        <ProviderState type="error" title="Task details are unavailable" description={error} onRetry={() => { setLoading(true); setReloadKey((key) => key + 1) }} />
      ) : !delivery ? (
        <ProviderState title="Task not found" description="This delivery may have been assigned to another volunteer or is no longer available." action={<Button to="/volunteer/tasks" size="small">Browse available tasks</Button>} />
      ) : (
        <Card className="provider-panel volunteer-task-detail">
          <div className="volunteer-delivery-top">
            <span className="volunteer-delivery-icon"><Package aria-hidden="true" /></span>
            <div className="volunteer-delivery-title">
              <span className="provider-panel-kicker">{listing?.foodCategory ? formatLabel(listing.foodCategory) : 'Food delivery'}</span>
              <h2>{listing?.title || 'Food delivery'}</h2>
              <p>{reservation?.approvedQuantity ?? listing?.quantity ?? '—'} {listing?.unit || ''}</p>
            </div>
            <span className={`provider-status status-${delivery.status}`}>{formatLabel(delivery.status)}</span>
          </div>
          <div className="volunteer-detail-grid">
            <section><h3><MapPin aria-hidden="true" /> Pickup location</h3><p>{listing?.pickupAddress || 'Pickup address unavailable'}</p></section>
            <section><h3><UserRound aria-hidden="true" /> Receiving organization</h3><p>{ngo?.organizationName || ngo?.name || 'Organization unavailable'}</p>{ngo?.phone && <a href={`tel:${ngo.phone}`}>{ngo.phone}</a>}</section>
            <section><h3><Clock3 aria-hidden="true" /> Collection deadline</h3><p>{formatDate(listing?.collectionDeadline)}</p></section>
            <section><h3><Truck aria-hidden="true" /> Delivery status</h3><p>{formatLabel(delivery.status)} · {formatLabel(delivery.collectionMethod)}</p></section>
          </div>
          <VolunteerRouteMap deliveryId={delivery._id} />
          <div className="volunteer-detail-actions">
            {canAccept ? (
              <Button disabled={busy} onClick={acceptTask}>{busy ? 'Accepting task…' : <><CheckCircle2 aria-hidden="true" /> Accept this task</>}</Button>
            ) : (
              <Button to="/volunteer/verification" variant="secondary">Open pickup & delivery</Button>
            )}
            <Link className="provider-text-link" to="/volunteer/deliveries">My assigned deliveries</Link>
          </div>
          {delivery.failureReason && <p className="provider-info-note">Failure note: {delivery.failureReason}</p>}
          {['assigned', 'accepted', 'picked_up', 'in_transit'].includes(delivery.status) && (
            <details className="volunteer-failure-panel">
              <summary>Unable to complete this delivery?</summary>
              <form className="volunteer-failure-form" onSubmit={reportFailure}>
                <label htmlFor="volunteer-failure-reason">Reason for reporting a delivery issue</label>
                <textarea
                  id="volunteer-failure-reason"
                  maxLength={500}
                  onChange={(event) => { setFailureReason(event.target.value); setFailureError('') }}
                  placeholder="Briefly explain what prevented the delivery."
                  rows={3}
                  value={failureReason}
                />
                <small>{failureReason.length}/500 characters. This will update the delivery and notify the provider and organization.</small>
                {failureError && <p className="provider-alert" role="alert">{failureError}</p>}
                <Button disabled={busy} type="submit" variant="secondary">{busy ? 'Submitting…' : 'Report delivery issue'}</Button>
              </form>
            </details>
          )}
        </Card>
      )}
    </div>
  )
}

export default TaskDetailsPage

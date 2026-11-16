import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Clock3, MapPin, Pencil, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import Modal from '../../components/common/Modal.jsx'
import FoodListingForm from '../../components/provider/FoodListingForm.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import {
  cancelProviderListing,
  getListingRecommendations,
  getProviderApiError,
  getProviderListing,
  getProviderReservations,
  updateProviderListing,
} from '../../services/providerService.js'
import { formatDate, formatLabel, getListingState, getReservedQuantity } from '../../utils/providerFormat.js'

function ListingDetailsPage() {
  const { listingId } = useParams()
  const location = useLocation()
  const [listing, setListing] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [recommendationError, setRecommendationError] = useState('')
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState(location.state?.notice || '')
  const [cancelOpen, setCancelOpen] = useState(false)

  const reservedQuantity = useMemo(() => getReservedQuantity(listing), [listing])

  const load = useCallback(async () => {
    const [listingResult, recommendationResult, reservationResult] = await Promise.allSettled([
      getProviderListing(listingId),
      getListingRecommendations(listingId),
      getProviderReservations({ page: 1, limit: 100, foodListingId: listingId }),
    ])
    if (listingResult.status === 'rejected') {
      setError(getProviderApiError(listingResult.reason))
      setLoading(false)
      return
    }
    const currentListing = listingResult.value.listing
    setListing(currentListing)
    if (recommendationResult.status === 'fulfilled') {
      setRecommendations(recommendationResult.value.recommendations || [])
      setRecommendationError('')
    } else {
      setRecommendations([])
      setRecommendationError(getProviderApiError(recommendationResult.reason))
    }
    if (reservationResult.status === 'fulfilled') {
      setReservations(reservationResult.value.reservations || [])
    } else {
      setReservations([])
    }
    setLoading(false)
  }, [listingId])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  function retryLoad() {
    setLoading(true)
    setError('')
    load()
  }

  async function saveListing(values) {
    setSaving(true)
    setActionError('')
    try {
      const result = await updateProviderListing(listingId, values)
      setListing(result.listing)
      setEditing(false)
      setNotice('Listing updated successfully.')
      await load()
    } catch (requestError) {
      const message = getProviderApiError(requestError)
      setActionError(message)
      throw new Error(message, { cause: requestError })
    } finally {
      setSaving(false)
    }
  }

  async function cancelListing() {
    setActionError('')
    try {
      const result = await cancelProviderListing(listingId)
      setListing(result.listing)
      setNotice('Listing cancelled.')
      setCancelOpen(false)
    } catch (requestError) {
      setActionError(getProviderApiError(requestError))
      setCancelOpen(false)
    }
  }

  if (loading) {
    return <div className="provider-loading"><Loading label="Loading listing details…" /></div>
  }
  if (error) {
    return (
      <div className="provider-page">
        <ProviderState type="error" title="Listing could not be loaded" description={error} onRetry={retryLoad} />
      </div>
    )
  }

  const status = getListingState(listing)
  const canEdit = !['cancelled', 'expired'].includes(status)
  const canCancel = canEdit && reservedQuantity === 0

  return (
    <div className="provider-page">
      <Link className="provider-back-link" to="/provider/listings"><ArrowLeft aria-hidden="true" /> Back to listings</Link>
      <ProviderPageHeader
        eyebrow={listing.foodCategory}
        title={listing.title}
        description={listing.description}
        actions={(
          <>
            {canEdit && (
              <Button onClick={() => setEditing((current) => !current)} variant="secondary">
                <Pencil aria-hidden="true" /> {editing ? 'Close editor' : 'Edit listing'}
              </Button>
            )}
            {canCancel && (
              <Button onClick={() => setCancelOpen(true)} variant="secondary">
                <XCircle aria-hidden="true" /> Cancel listing
              </Button>
            )}
          </>
        )}
      />

      {notice && <div className="provider-success" role="status">{notice}</div>}
      {actionError && <div className="provider-alert" role="alert">{actionError}</div>}

      {editing && (
        <Card className="provider-panel provider-form-panel">
          <div className="provider-panel-heading"><h2>Edit listing details</h2></div>
          {reservedQuantity > 0 && (
            <p className="provider-info-note">
              {reservedQuantity} {listing.unit} is reserved. The total quantity cannot be reduced below this amount.
            </p>
          )}
          <FoodListingForm
            initialListing={listing}
            isSubmitting={saving}
            onCancel={() => setEditing(false)}
            onSubmit={saveListing}
            submitLabel="Save changes"
          />
        </Card>
      )}

      <div className="provider-details-grid">
        <Card className="provider-panel">
          <div className="provider-panel-heading"><h2>Inventory and collection</h2></div>
          <div className="provider-detail-stats">
            <div><small>Total quantity</small><strong>{listing.quantity} {listing.unit}</strong></div>
            <div><small>Available</small><strong>{listing.availableQuantity} {listing.unit}</strong></div>
            <div><small>Reserved</small><strong>{reservedQuantity} {listing.unit}</strong></div>
            <div><small>Status</small><span className={`provider-status status-${status}`}>{formatLabel(status)}</span></div>
          </div>
          <div className="provider-detail-list">
            <p><Clock3 aria-hidden="true" /><span><small>Prepared</small>{formatDate(listing.preparedAt)}</span></p>
            <p><Clock3 aria-hidden="true" /><span><small>Collection deadline</small>{formatDate(listing.collectionDeadline)}</span></p>
            <p><MapPin aria-hidden="true" /><span><small>Pickup address</small>{listing.pickupAddress}</span></p>
            <p><ShieldCheck aria-hidden="true" /><span><small>Storage conditions</small>{listing.storageCondition}</span></p>
            <p><span className="provider-detail-bullet" /><span><small>Allergens</small>{listing.allergens?.length ? listing.allergens.join(', ') : 'Not specified'}</span></p>
          </div>
          {!canCancel && reservedQuantity > 0 && canEdit && (
            <p className="provider-field-help">Listings with reservations cannot be cancelled. Fulfil or resolve those requests first.</p>
          )}
        </Card>

        <Card className="provider-panel">
          <div className="provider-panel-heading">
            <div>
              <span className="provider-panel-kicker">Deterministic matching</span>
              <h2>Recommended NGOs</h2>
            </div>
            <Button onClick={retryLoad} variant="quiet" size="small"><RefreshCw aria-hidden="true" /> Refresh</Button>
          </div>
          {recommendationError ? (
            <ProviderState
              title="Recommendations unavailable"
              description={recommendationError}
              onRetry={retryLoad}
              type="error"
            />
          ) : recommendations.length ? (
            <div className="provider-recommendations">
              {recommendations.map((recommendation) => (
                <article className="provider-recommendation" key={recommendation.ngo.id}>
                  <div className="provider-recommendation-top">
                    <div>
                      <strong>{recommendation.ngo.organizationName || recommendation.ngo.name}</strong>
                      <small>{recommendation.distanceKm} km away · {recommendation.estimatedTravelMinutes} min estimated travel</small>
                    </div>
                    <span className="provider-score">{recommendation.score}<small>/100</small></span>
                  </div>
                  <p>{recommendation.recommendedQuantity == null
                    ? 'Pickup capacity is not configured for this unit.'
                    : `Recommended amount: ${recommendation.recommendedQuantity} ${recommendation.unit}`}</p>
                  <details>
                    <summary>Why this match?</summary>
                    <ul>
                      {Object.entries(recommendation.scoreBreakdown || {}).map(([factor, breakdown]) => (
                        <li key={factor}>
                          <strong>{formatLabel(factor)}</strong> · {breakdown.score}/100 · {breakdown.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <ProviderState
              title="No suitable NGOs found"
              description="No verified, active organization currently matches this food, location, quantity, and deadline."
            />
          )}
        </Card>
      </div>

      <Card className="provider-panel">
        <div className="provider-panel-heading">
          <div><span className="provider-panel-kicker">Requests for this food</span><h2>Reservations</h2></div>
          <Link className="provider-text-link" to="/provider/reservations">Manage requests <ArrowLeft className="provider-arrow-flip" aria-hidden="true" /></Link>
        </div>
        {reservations.length ? (
          <div className="provider-table-scroll">
            <table className="provider-table">
              <thead><tr><th>Organization</th><th>Requested</th><th>Approved</th><th>Collection</th><th>Status</th></tr></thead>
              <tbody>
                {reservations.map((reservation) => (
                  <tr key={reservation._id}>
                    <td>{reservation.ngo?.organizationName || reservation.ngo?.name || 'Organization'}</td>
                    <td>{reservation.requestedQuantity} {listing.unit}</td>
                    <td>{reservation.approvedQuantity ?? '—'}</td>
                    <td>{formatLabel(reservation.collectionMethod)}</td>
                    <td><span className={`provider-status status-${reservation.status}`}>{formatLabel(reservation.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ProviderState title="No reservation requests" description="Requests for this listing will appear here." />
        )}
      </Card>

      <Modal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this listing?">
        <p className="provider-modal-copy">The listing will no longer be available for new reservation requests. This action cannot be undone.</p>
        <div className="provider-form-actions">
          <Button onClick={() => setCancelOpen(false)} variant="secondary">Keep listing</Button>
          <Button onClick={cancelListing} variant="primary">Cancel listing</Button>
        </div>
      </Modal>
    </div>
  )
}

export default ListingDetailsPage

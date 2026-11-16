import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Clock3, MapPin, PackageCheck, ShieldCheck, Thermometer } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import FoodListingCard from '../../components/ngo/FoodListingCard.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import {
  getAvailableListing,
  getNgoApiError,
  getRecommendedListings,
  requestFoodReservation,
} from '../../services/ngoService.js'
import { formatDate } from '../../utils/providerFormat.js'

function FoodListingDetailsPage() {
  const { listingId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [listing, setListing] = useState(null)
  const [recommendation, setRecommendation] = useState(location.state?.recommendation || null)
  const [quantity, setQuantity] = useState('')
  const [collectionMethod, setCollectionMethod] = useState('self_pickup')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [requestError, setRequestError] = useState('')

  const load = useCallback(async () => {
    const [listingResult, recommendationResult] = await Promise.allSettled([
      getAvailableListing(listingId),
      user.isVerified ? getRecommendedListings({ limit: 100 }) : Promise.resolve({ recommendations: [] }),
    ])
    if (listingResult.status === 'rejected') {
      setError(getNgoApiError(listingResult.reason))
    } else {
      setListing(listingResult.value.listing)
    }
    if (recommendationResult.status === 'fulfilled') {
      const found = (recommendationResult.value.recommendations || [])
        .find((item) => String(item.listing?._id) === String(listingId))
      if (found) setRecommendation(found)
    }
    setLoading(false)
  }, [listingId, user.isVerified])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  async function submitReservation(event) {
    event.preventDefault()
    setRequestError('')
    const requestedQuantity = Number(quantity)
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      setRequestError('Enter a quantity greater than zero.')
      return
    }
    if (requestedQuantity > listing.availableQuantity) {
      setRequestError(`Only ${listing.availableQuantity} ${listing.unit} are currently available.`)
      return
    }
    setSubmitting(true)
    try {
      const { reservation } = await requestFoodReservation({
        foodListingId: listing._id,
        requestedQuantity,
        collectionMethod,
      })
      navigate(`/ngo/reservations/${reservation._id}`, {
        replace: true,
        state: { notice: 'Reservation request sent to the provider.' },
      })
    } catch (requestErrorValue) {
      setRequestError(getNgoApiError(requestErrorValue))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="provider-loading"><Loading label="Loading food details…" /></div>
  }
  if (error || !listing) {
    return (
      <div className="provider-page">
        <ProviderState
          type="error"
          title="Food listing unavailable"
          description={error || 'This listing could not be found.'}
          action={<Button to="/ngo/food" size="small" variant="secondary">Back to available food</Button>}
        />
      </div>
    )
  }

  return (
    <div className="provider-page">
      <Link className="provider-back-link" to="/ngo/food"><ArrowLeft aria-hidden="true" /> Back to food discovery</Link>
      <ProviderPageHeader
        eyebrow={listing.foodCategory}
        title={listing.title}
        description={listing.description}
        actions={<span className="provider-status status-available">Available to request</span>}
      />

      <div className="ngo-listing-detail-grid">
        <div className="ngo-listing-detail-main">
          <Card className="provider-panel">
            <div className="provider-panel-heading"><h2>Food and collection details</h2></div>
            <div className="provider-detail-stats">
              <div><small>Available quantity</small><strong>{listing.availableQuantity} {listing.unit}</strong></div>
              <div><small>Category</small><strong>{listing.foodCategory}</strong></div>
              <div><small>Prepared</small><strong>{formatDate(listing.preparedAt)}</strong></div>
              <div><small>Collection deadline</small><strong>{formatDate(listing.collectionDeadline)}</strong></div>
            </div>
            <div className="provider-detail-list">
              <p><MapPin aria-hidden="true" /><span><small>Pickup address</small>{listing.pickupAddress}</span></p>
              <p><Thermometer aria-hidden="true" /><span><small>Storage conditions</small>{listing.storageCondition}</span></p>
              <p><ShieldCheck aria-hidden="true" /><span><small>Allergens</small>{listing.allergens?.length ? listing.allergens.join(', ') : 'Not specified'}</span></p>
              <p><PackageCheck aria-hidden="true" /><span><small>Provider</small>{listing.provider?.organizationName || listing.provider?.name || 'Food provider'}</span></p>
              <p><Clock3 aria-hidden="true" /><span><small>Deadline</small>Collection must be completed before {formatDate(listing.collectionDeadline)}.</span></p>
            </div>
          </Card>

          {recommendation && (
            <FoodListingCard listing={listing} recommendation={recommendation} showDetailsLink={false} />
          )}
        </div>

        <Card className="provider-panel ngo-request-card">
          <div className="provider-panel-heading">
            <div><span className="provider-panel-kicker">Request food</span><h2>Reserve a quantity</h2></div>
          </div>
          {user.isVerified === false ? (
            <div className="provider-info-note">
              Your NGO must be verified before it can request food. Contact the platform administrator to complete verification.
            </div>
          ) : (
            <form className="provider-form" onSubmit={submitReservation}>
              {requestError && <div className="provider-alert" role="alert">{requestError}</div>}
              <label className="provider-field">
                <span>Requested quantity ({listing.unit})</span>
                <input
                  max={listing.availableQuantity}
                  min="0.01"
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder={`Up to ${listing.availableQuantity}`}
                  required
                  step="any"
                  type="number"
                  value={quantity}
                />
              </label>
              <label className="provider-field">
                <span>Collection method</span>
                <select onChange={(event) => setCollectionMethod(event.target.value)} value={collectionMethod}>
                  <option value="self_pickup">We will pick it up</option>
                  <option value="volunteer_delivery">Request volunteer delivery</option>
                </select>
              </label>
              <p className="provider-field-help">
                The provider must confirm your request before food is allocated. Your request does not reserve stock until confirmation.
              </p>
              <Button disabled={submitting || listing.availableQuantity <= 0} type="submit">
                {submitting ? 'Sending request…' : 'Request food'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}

export default FoodListingDetailsPage

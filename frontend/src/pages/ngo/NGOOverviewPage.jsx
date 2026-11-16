import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Bell, Clock3, MapPin, PackageSearch } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import FoodPhoto from '../../components/common/FoodPhoto.jsx'
import FoodListingCard from '../../components/ngo/FoodListingCard.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import useRealtimeEvent from '../../hooks/useRealtimeEvent.js'
import {
  getAvailableListings,
  getNgoApiError,
  getNgoNotifications,
  getNgoOverview,
  getNgoReservations,
} from '../../services/ngoService.js'
import { formatDate, formatLabel, formatQuantities } from '../../utils/providerFormat.js'

function NGOOverviewPage() {
  const { user } = useAuth()
  const [overview, setOverview] = useState(null)
  const [listings, setListings] = useState([])
  const [reservations, setReservations] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const [overviewResult, listingResult, reservationResult, notificationResult] = await Promise.all([
        getNgoOverview(),
        getAvailableListings({ page: 1, limit: 4 }),
        getNgoReservations({ page: 1, limit: 4 }),
        getNgoNotifications({ page: 1, limit: 1, isRead: false }),
      ])
      setOverview(overviewResult)
      setListings(listingResult.listings || [])
      setReservations(reservationResult.reservations || [])
      setUnreadCount(notificationResult.pagination?.total || 0)
    } catch (requestError) {
      setError(getNgoApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useRealtimeEvent('notification:new', () => { void load() })
  useRealtimeEvent('reservation:updated', () => { void load() })
  useRealtimeEvent('delivery:updated', () => { void load() })

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load, reloadKey])

  function retry() {
    setLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="provider-page ngo-overview-page">
      <section className="ngo-market-hero">
        <div className="ngo-market-copy">
          <span className="eyebrow">The neighborhood food board <i aria-hidden="true" /></span>
          <h1>Good food is <em>closer</em> than you think.</h1>
          <p>Welcome, {user.organizationName || user.name}. Discover nearby surplus, plan a pickup, and bring fresh food to your community.</p>
          <div className="provider-hero-actions">
            <Button to="/ngo/food"><PackageSearch aria-hidden="true" /> Explore available food</Button>
            <Link className="editorial-text-link" to="/ngo/map"><MapPin aria-hidden="true" /> Open the nearby map</Link>
          </div>
          <div className="ngo-market-caption"><span className="live-dot" /> Live opportunities from your food network</div>
        </div>
        <div className="ngo-market-image">
          <FoodPhoto
            alt="A bowl of fresh seasonal produce"
            category={listings[0]?.foodCategory || 'produce'}
            image={listings[0]?.image}
          />
          {listings[0] && (
            <Link className="ngo-featured-listing" to={`/ngo/food/${listings[0]._id}`}>
              <span><small>Available nearby</small><strong>{listings[0].title}</strong></span>
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>

      {user.isVerified === false && (
        <div className="provider-info-note" role="status">
          Your NGO account is awaiting verification. You can explore available food, but the backend will prevent reservation requests until your organization is verified.
        </div>
      )}

      {error ? (
        <ProviderState type="error" title="NGO overview unavailable" description={error} onRetry={retry} />
      ) : loading ? (
        <div className="provider-loading"><Loading label="Loading your NGO overview…" /></div>
      ) : overview ? (
        <>
          <div className="ngo-impact-strip">
            <div><small>Waiting for provider</small><strong>{overview.pendingReservations ?? 0}</strong></div>
            <div><small>Food collected</small><strong>{formatQuantities(overview.totalFoodQuantityCollected)}</strong></div>
            <div><small>Completed pickups</small><strong>{overview.completedReservations ?? 0}</strong></div>
            <Link to="/ngo/notifications"><Bell aria-hidden="true" /><span><strong>{unreadCount}</strong><small>unread updates</small></span><ArrowRight aria-hidden="true" /></Link>
          </div>

          <div className="ngo-overview-grid">
            <section className="ngo-discovery-section">
              <div className="editorial-section-heading">
                <div><span className="provider-panel-kicker">Selected for your organization</span><h2>Food to explore</h2></div>
                <Link className="editorial-text-link" to="/ngo/food">Browse the marketplace <ArrowRight aria-hidden="true" /></Link>
              </div>
              {listings.length ? (
                <div className="ngo-overview-food-grid">
                  {listings.slice(0, 3).map((listing) => (
                    <FoodListingCard key={listing._id} listing={listing} />
                  ))}
                </div>
              ) : (
                <ProviderState
                  title="No available food nearby"
                  description="New food listings will appear here when providers share surplus."
                  action={<Button to="/ngo/food" size="small">Browse listings</Button>}
                />
              )}
            </section>

            <aside className="ngo-reservation-column">
              <section className="ngo-reservation-panel">
                <div className="editorial-section-heading">
                  <div><span className="provider-panel-kicker">Your requests</span><h2>Collection activity</h2></div>
                  <Link className="editorial-icon-link" to="/ngo/reservations" aria-label="View all reservations"><ArrowRight aria-hidden="true" /></Link>
                </div>
                <span className="ngo-reservation-intro"><Clock3 aria-hidden="true" /> Keep an eye on collection deadlines and provider replies.</span>
                {reservations.length ? (
                  <div className="ngo-reservation-list">
                    {reservations.map((reservation) => (
                      <Link className="ngo-reservation-item" key={reservation._id} to={`/ngo/reservations/${reservation._id}`}>
                        <span className={`reservation-status-marker status-${reservation.status}`} />
                        <span><small>{formatLabel(reservation.status)} · {formatDate(reservation.requestedAt)}</small><strong>{reservation.foodListing?.title || 'Food reservation'}</strong><span>{reservation.requestedQuantity} {reservation.foodListing?.unit || ''}</span></span>
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <ProviderState title="No reservation activity" description="Your requests and collection history will appear here." />
                )}
              </section>
              <Link className="ngo-map-promo" to="/ngo/map">
                <span><MapPin aria-hidden="true" /></span>
                <strong>Know what’s around the corner.</strong>
                <small>Explore pickup locations on the live map.</small>
                <span className="ngo-map-promo-link">Open map <ArrowRight aria-hidden="true" /></span>
              </Link>
            </aside>
          </div>
          <div className="provider-data-note">Impact figures are retrieved from your authenticated NGO analytics endpoint. Quantities remain grouped by unit.</div>
        </>
      ) : null}
    </div>
  )
}

export default NGOOverviewPage

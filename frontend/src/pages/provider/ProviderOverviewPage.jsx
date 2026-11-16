import { useCallback, useEffect, useState } from 'react'
import { ArrowDownRight, ArrowRight, Clock3, PackageCheck, PackagePlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import FoodPhoto from '../../components/common/FoodPhoto.jsx'
import Loading from '../../components/common/Loading.jsx'
import Button from '../../components/common/Button.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import {
  getProviderListings,
  getProviderOverview,
  getProviderReservations,
  getProviderApiError,
} from '../../services/providerService.js'
import { formatDate, formatQuantities, formatLabel } from '../../utils/providerFormat.js'

function ProviderOverviewPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [recentListings, setRecentListings] = useState([])
  const [pendingReservations, setPendingReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const [overview, listingResult, reservationResult] = await Promise.all([
        getProviderOverview(),
        getProviderListings({ page: 1, limit: 5, sort: 'newest' }),
        getProviderReservations({ page: 1, limit: 5, status: 'pending' }),
      ])
      setData(overview)
      setRecentListings(listingResult.listings || [])
      setPendingReservations(reservationResult.reservations || [])
    } catch (requestError) {
      setError(getProviderApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load, reloadKey])

  return (
    <div className="provider-page provider-overview-page">
      <section className="provider-hero">
        <div className="provider-hero-copy">
          <span className="eyebrow">Provider studio <i aria-hidden="true" /></span>
          <h1>Make today’s surplus someone’s <em>next meal.</em></h1>
          <p>Welcome back, {user.organizationName || user.name}. Keep your available food moving to the organizations that need it.</p>
          <div className="provider-hero-actions">
            <Button to="/provider/listings/new"><PackagePlus aria-hidden="true" /> List surplus food</Button>
            <Link className="editorial-text-link" to="/provider/listings">Review your inventory <ArrowRight aria-hidden="true" /></Link>
          </div>
          <div className="provider-hero-footnote"><ArrowDownRight aria-hidden="true" /> A clear handoff starts with a good listing.</div>
        </div>
        <div className="provider-hero-image">
          <FoodPhoto
            alt="Fresh produce ready to be shared"
            category={recentListings[0]?.foodCategory || 'produce'}
            image={recentListings[0]?.image}
          />
          <div className="provider-image-note">
            <span className="live-dot" />
            <span><strong>{recentListings.length ? 'Your latest offering' : 'A better destination'}</strong><small>{recentListings[0]?.title || 'Good food, shared locally'}</small></span>
          </div>
          <span className="provider-image-index">01 / FOOD IN MOTION</span>
        </div>
      </section>

      {error && (
        <ProviderState
          type="error"
          title="Dashboard data is unavailable"
          description={error}
          onRetry={() => {
            setError('')
            setLoading(true)
            setReloadKey((key) => key + 1)
          }}
        />
      )}

      {!error && loading && <div className="provider-loading"><Loading label="Loading your dashboard…" /></div>}

      {!error && !loading && data && (
        <>
          <div className="provider-impact-strip" aria-label="Provider impact at a glance">
            <div><small>Active listings</small><strong>{data.activeFoodListings ?? 0}</strong></div>
            <div><small>Food listed</small><strong>{formatQuantities(data.totalFoodQuantityListed)}</strong></div>
            <div><small>Redistributed</small><strong>{formatQuantities(data.totalFoodQuantityRedistributed)}</strong></div>
            <div><small>Successful deliveries</small><strong>{data.successfulDeliveries ?? 0}</strong></div>
          </div>

          <div className="provider-dashboard-grid provider-overview-grid">
            <section className="editorial-panel provider-inventory-panel">
              <div className="editorial-section-heading">
                <div><span className="provider-panel-kicker">Your inventory</span><h2>Recently listed</h2></div>
                <Link className="editorial-text-link" to="/provider/listings">All listings <ArrowRight aria-hidden="true" /></Link>
              </div>
              {recentListings.length ? (
                <div className="provider-inventory-list">
                  {recentListings.map((listing) => (
                    <Link className="provider-inventory-item" key={listing._id} to={`/provider/listings/${listing._id}`}>
                      <FoodPhoto alt="" category={listing.foodCategory} image={listing.image} />
                      <span className="provider-inventory-info">
                        <small>{listing.foodCategory} <i aria-hidden="true">·</i> {formatLabel(listing.status)}</small>
                        <strong>{listing.title}</strong>
                        <span><Clock3 aria-hidden="true" /> Collect by {formatDate(listing.collectionDeadline)}</span>
                      </span>
                      <span className="provider-quantity"><strong>{listing.availableQuantity} {listing.unit}</strong><small>available</small></span>
                    </Link>
                  ))}
                </div>
              ) : (
                <ProviderState
                  title="No listings yet"
                  description="Create your first listing to share available food with local organizations."
                  action={<Button to="/provider/listings/new" size="small">Create listing</Button>}
                />
              )}
            </section>

            <aside className="provider-side-column">
              <section className="provider-request-panel">
                <div className="editorial-section-heading">
                  <div><span className="provider-panel-kicker">Ready for your review</span><h2>Incoming requests</h2></div>
                  <Link className="editorial-icon-link" to="/provider/reservations" aria-label="View all reservation requests"><ArrowRight aria-hidden="true" /></Link>
                </div>
                {pendingReservations.length ? (
                  <div className="provider-request-list">
                    {pendingReservations.map((reservation) => (
                      <Link className="provider-request-item" key={reservation._id} to="/provider/reservations">
                        <span className="request-mark"><PackageCheck aria-hidden="true" /></span>
                        <span><strong>{reservation.ngo?.organizationName || reservation.ngo?.name || 'Organization request'}</strong><small>{reservation.foodListing?.title || 'Food listing'} · {reservation.requestedQuantity} {reservation.foodListing?.unit}</small></span>
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <ProviderState title="No pending requests" description="New reservation requests for your food listings will appear here." />
                )}
              </section>
              <div className="provider-deadline-note">
                <span className="provider-panel-kicker">Next collection window</span>
                {recentListings[0] ? (
                  <>
                    <strong>{recentListings[0].title}</strong>
                    <span><Clock3 aria-hidden="true" /> {formatDate(recentListings[0].collectionDeadline)}</span>
                  </>
                ) : (
                  <p>Your collection deadlines will appear here alongside your active listings.</p>
                )}
                <Link className="editorial-text-link" to="/provider/pickups">Pickup activity <ArrowRight aria-hidden="true" /></Link>
              </div>
            </aside>
          </div>
          <p className="provider-data-note">Dashboard figures are loaded from your provider analytics API.</p>
        </>
      )}
    </div>
  )
}

export default ProviderOverviewPage

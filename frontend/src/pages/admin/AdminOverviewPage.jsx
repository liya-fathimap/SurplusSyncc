import { useCallback, useEffect, useState } from 'react'
import { Activity, ArrowRight, BadgeCheck, Clock3, MapPin, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import AdminOperationsMap from '../../components/admin/AdminOperationsMap.jsx'
import Loading from '../../components/common/Loading.jsx'
import FoodPhoto from '../../components/common/FoodPhoto.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import {
  getAdminApiError,
  getAdminDeliveryRoute,
  getAdminMonitor,
  getAdminOverview,
  getAdminUsers,
} from '../../services/adminService.js'
import { formatDate, formatLabel, formatQuantities } from '../../utils/providerFormat.js'

function AdminOverviewPage() {
  const [overview, setOverview] = useState(null)
  const [operations, setOperations] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      getAdminOverview(),
      getAdminMonitor('listings', { status: 'available', page: 1, limit: 20 }),
      getAdminMonitor('deliveries', { status: 'in_transit', page: 1, limit: 5 }),
      getAdminMonitor('deliveries', { status: 'failed', page: 1, limit: 4 }),
      getAdminMonitor('activity-logs', { page: 1, limit: 6 }),
      getAdminUsers({ role: 'provider', verificationStatus: 'pending', page: 1, limit: 4 }),
      getAdminUsers({ role: 'ngo', verificationStatus: 'pending', page: 1, limit: 4 }),
    ])

    if (results[0].status === 'rejected') {
      setError(getAdminApiError(results[0].reason))
      setLoading(false)
      return
    }

    const names = ['platform totals', 'available listings', 'active deliveries', 'failed deliveries', 'activity logs', 'provider reviews', 'NGO reviews']
    const values = results.map((result, index) => {
      if (result.status === 'fulfilled') return result.value
      return { unavailable: names[index], message: getAdminApiError(result.reason) }
    })
    const listings = values[1].listings || []
    const activeDeliveries = values[2].deliveries || []
    const routeResults = await Promise.allSettled(activeDeliveries.map((delivery) => getAdminDeliveryRoute(delivery._id)))
    const routes = routeResults.flatMap((result, index) => (
      result.status === 'fulfilled'
        ? [{ delivery: activeDeliveries[index], routeData: result.value }]
        : []
    ))
    const routeWarnings = routeResults.flatMap((result, index) => (
      result.status === 'rejected'
        ? [{
            unavailable: `route for ${activeDeliveries[index].reservation?.foodListing?.title || 'an active delivery'}`,
            message: getAdminApiError(result.reason),
          }]
        : []
    ))

    setOverview(results[0].value)
    setOperations({
      listings: listings
        .filter((listing) => Number.isFinite(new Date(listing.collectionDeadline).getTime()))
        .sort((left, right) => new Date(left.collectionDeadline) - new Date(right.collectionDeadline))
        .slice(0, 4),
      activeDeliveries,
      failedDeliveries: values[3].deliveries || [],
      activity: values[4].activityLogs || [],
      pendingOrganizations: [...(values[5].users || []), ...(values[6].users || [])],
      routes,
      warnings: [...values.filter((value) => value.unavailable), ...routeWarnings],
    })
    setError('')
    setLoading(false)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load, reloadKey])

  function retry() {
    setLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="provider-page admin-page admin-overview-page">
      <section className="admin-ops-hero">
        <div>
          <span className="eyebrow">SurplusSync · operations control room</span>
          <h1>The network, <em>at a glance.</em></h1>
          <p>See what’s moving, what needs attention, and where the next food handoff is taking shape.</p>
        </div>
        {overview && (
          <div className="admin-ops-totals">
            <div><small>Redistributed</small><strong>{formatQuantities(overview.totalFoodQuantityRedistributed)}</strong></div>
            <div><small>Active listings</small><strong>{overview.activeFoodListings ?? 0}</strong></div>
            <div><small>Successful deliveries</small><strong>{overview.successfulDeliveries ?? 0}</strong></div>
          </div>
        )}
      </section>

      {error ? (
        <ProviderState type="error" title="Platform overview unavailable" description={error} onRetry={retry} />
      ) : loading ? (
        <div className="provider-loading"><Loading label="Loading live platform operations…" /></div>
      ) : operations && overview ? (
        <>
          {operations.warnings.length > 0 && (
            <div className="provider-info-note" role="status">
              Some operations data could not be refreshed:
              <ul>
                {operations.warnings.map((warning, index) => <li key={`${warning.unavailable}-${index}`}>{warning.unavailable}: {warning.message}</li>)}
              </ul>
            </div>
          )}
          <div className="admin-ops-grid">
            <section className="admin-map-panel">
              <div className="admin-map-heading">
                <div><span className="provider-panel-kicker">Live network view</span><h2>Food and delivery corridors</h2></div>
                <span className="admin-map-legend"><i aria-hidden="true" /> Pickup listings <i className="route-key" aria-hidden="true" /> Planned routes</span>
              </div>
              <AdminOperationsMap listings={operations.listings} routes={operations.routes} />
              <div className="admin-map-footer">
                <span><MapPin aria-hidden="true" /> {operations.listings.length} nearest collection windows</span>
                <span><Truck aria-hidden="true" /> {operations.routes.length} route{operations.routes.length === 1 ? '' : 's'} available</span>
              </div>
            </section>

            <aside className="admin-ops-rail">
              <section className="admin-queue-panel urgent-listings-panel">
                <div className="editorial-section-heading">
                  <div><span className="provider-panel-kicker">Soonest collection deadlines</span><h2>Food needing a match</h2></div>
                  <Link className="editorial-icon-link" to="/admin/listings" aria-label="View all food listings"><ArrowRight aria-hidden="true" /></Link>
                </div>
                {operations.listings.length ? (
                  <div className="admin-urgent-list">
                    {operations.listings.map((listing) => (
                      <article className="admin-urgent-item" key={listing._id}>
                        <FoodPhoto alt="" category={listing.foodCategory} image={listing.image} />
                        <span><small>{listing.foodCategory} · {listing.availableQuantity} {listing.unit}</small><strong>{listing.title}</strong><time dateTime={listing.collectionDeadline}><Clock3 aria-hidden="true" /> {formatDate(listing.collectionDeadline)}</time></span>
                      </article>
                    ))}
                  </div>
                ) : <ProviderState title="No available listings" description="New food listings will appear here." />}
              </section>

              <section className="admin-queue-panel verification-panel">
                <div className="editorial-section-heading">
                  <div><span className="provider-panel-kicker">Trust and safety</span><h2>Organization reviews</h2></div>
                  <Link className="editorial-icon-link" to="/admin/providers" aria-label="Open provider verification"><ArrowRight aria-hidden="true" /></Link>
                </div>
                {operations.pendingOrganizations.length ? (
                  <div className="admin-review-list">
                    {operations.pendingOrganizations.slice(0, 5).map((organization) => (
                      <Link key={organization._id} to={`/admin/${organization.role === 'ngo' ? 'ngos' : 'providers'}`} className="admin-review-item">
                        <span className="admin-review-icon"><BadgeCheck aria-hidden="true" /></span>
                        <span><strong>{organization.organizationName || organization.name}</strong><small>{formatLabel(organization.role)} · registered {formatDate(organization.createdAt)}</small></span>
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                ) : <ProviderState title="No pending reviews" description="Provider and NGO verification requests appear here." />}
                <div className="admin-review-links"><Link to="/admin/providers">Providers</Link><Link to="/admin/ngos">NGOs</Link></div>
              </section>
            </aside>
          </div>

          <div className="admin-bottom-grid">
            <section className="admin-exceptions-panel">
              <div className="editorial-section-heading">
                <div><span className="provider-panel-kicker">Delivery exceptions</span><h2><Truck aria-hidden="true" /> Failed deliveries</h2></div>
                <Link className="editorial-text-link" to="/admin/deliveries">Delivery monitor <ArrowRight aria-hidden="true" /></Link>
              </div>
              {operations.failedDeliveries.length ? (
                <div className="admin-exception-list">
                  {operations.failedDeliveries.slice(0, 3).map((delivery) => (
                    <div className="admin-exception-item" key={delivery._id}>
                      <span className="status-pip status-failed" />
                      <span><strong>{delivery.reservation?.foodListing?.title || 'Food delivery'}</strong><small>{delivery.volunteer?.name || 'No volunteer'} · {formatDate(delivery.updatedAt || delivery.createdAt)}</small></span>
                      <span className="provider-status status-failed">{formatLabel(delivery.status)}</span>
                    </div>
                  ))}
                </div>
              ) : <ProviderState title="No failed deliveries" description="Failed deliveries from the operations monitor will appear here." />}
            </section>

            <section className="admin-activity-panel">
              <div className="editorial-section-heading">
                <div><span className="provider-panel-kicker">Recent system activity</span><h2><Activity aria-hidden="true" /> Audit trail</h2></div>
                <Link className="editorial-icon-link" to="/admin/activity" aria-label="View all activity logs"><ArrowRight aria-hidden="true" /></Link>
              </div>
              {operations.activity.length ? (
                <ol className="admin-activity-list">
                  {operations.activity.map((item) => (
                    <li key={item._id}><span className="activity-dot" /><span><strong>{formatLabel(item.action)}</strong><small>{item.actor?.name || 'System'} · {formatLabel(item.entityType)}</small></span><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></li>
                  ))}
                </ol>
              ) : <ProviderState title="No activity recorded yet" description="Platform operations will be recorded here." />}
            </section>
          </div>

          <div className="admin-overview-links">
            <Link to="/admin/users">User management <ArrowRight aria-hidden="true" /></Link>
            <Link to="/admin/analytics">Platform analytics <ArrowRight aria-hidden="true" /></Link>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default AdminOverviewPage

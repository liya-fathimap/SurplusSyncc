import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Bell, CheckCircle2, Clock3, MapPin, PackageSearch, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Loading from '../../components/common/Loading.jsx'
import VolunteerDeliveryCard from '../../components/volunteer/VolunteerDeliveryCard.jsx'
import VolunteerPageHeader from '../../components/volunteer/VolunteerPageHeader.jsx'
import VolunteerRouteMap from '../../components/volunteer/VolunteerRouteMap.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import useRealtimeEvent from '../../hooks/useRealtimeEvent.js'
import {
  getVolunteerApiError,
  getVolunteerAvailableTasks,
  getVolunteerDeliveries,
  getVolunteerNotifications,
  markVolunteerNotificationRead,
} from '../../services/volunteerService.js'
import { formatDate, formatLabel } from '../../utils/providerFormat.js'

const activeStatuses = ['assigned', 'accepted', 'picked_up', 'in_transit']

function VolunteerOverviewPage() {
  const [available, setAvailable] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    setError('')
    try {
      const results = await Promise.allSettled([
        getVolunteerAvailableTasks(),
        getVolunteerDeliveries(),
        getVolunteerNotifications({ page: 1, limit: 5 }),
        getVolunteerNotifications({ page: 1, limit: 1, isRead: false }),
      ])
      const failures = results.filter((result) => result.status === 'rejected')
      if (failures.length === results.length) {
        throw failures[0].reason
      }
      if (results[0].status === 'fulfilled') setAvailable(results[0].value.deliveries || [])
      if (results[1].status === 'fulfilled') setDeliveries(results[1].value.deliveries || [])
      if (results[2].status === 'fulfilled') setNotifications(results[2].value.notifications || [])
      if (results[3].status === 'fulfilled') setUnreadCount(results[3].value.pagination?.total || 0)
      if (failures.length) {
        setError(`Some dashboard information could not be loaded. ${getVolunteerApiError(failures[0].reason)}`)
      }
    } catch (requestError) {
      setError(getVolunteerApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useRealtimeEvent('delivery:available', () => { void load() })
  useRealtimeEvent('delivery:updated', () => { void load() })
  useRealtimeEvent('notification:new', () => { void load() })

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load, reloadKey])

  async function markAsRead(notificationId) {
    setBusyId(notificationId)
    setActionError('')
    try {
      await markVolunteerNotificationRead(notificationId)
      setNotifications((current) => current.map((item) => (
        item._id === notificationId ? { ...item, isRead: true } : item
      )))
    } catch (requestError) {
      setActionError(getVolunteerApiError(requestError))
    } finally {
      setBusyId('')
    }
  }

  const activeDeliveries = deliveries.filter((delivery) => activeStatuses.includes(delivery.status))
  const featuredDelivery = activeDeliveries[0] || available[0]

  return (
    <div className="provider-page volunteer-page volunteer-overview-page">
      <VolunteerPageHeader
        title="The next good handoff starts here."
        description="Your delivery desk keeps the route, collection window, and next action together."
        actions={<Button to="/volunteer/tasks"><PackageSearch aria-hidden="true" /> Find a delivery</Button>}
      />
      {error && <div className="volunteer-inline-error" role="alert">{error}</div>}
      {actionError && <div className="provider-alert" role="alert">{actionError}</div>}
      {loading ? (
        <div className="provider-loading"><Loading label="Loading your volunteer dashboard…" /></div>
      ) : (
        <>
          <div className="volunteer-shift-strip">
            <span className="volunteer-shift-label"><span className="live-dot" /> Your shift, at a glance</span>
            <div><PackageSearch aria-hidden="true" /><strong>{error ? '—' : available.length}</strong><small>open tasks</small></div>
            <div><Truck aria-hidden="true" /><strong>{error ? '—' : activeDeliveries.length}</strong><small>active routes</small></div>
            <div><CheckCircle2 aria-hidden="true" /><strong>{error ? '—' : deliveries.filter((delivery) => delivery.status === 'delivered').length}</strong><small>completed</small></div>
            <Link to="/volunteer/notifications"><Bell aria-hidden="true" /><strong>{error ? '—' : unreadCount}</strong><small>new updates</small></Link>
          </div>

          <div className="volunteer-route-layout">
            <section className="volunteer-route-focus">
              <div className="editorial-section-heading">
                <div><span className="provider-panel-kicker">Live route desk</span><h2>{activeDeliveries.length ? 'Your active delivery' : 'A route ready to claim'}</h2></div>
                <Link className="editorial-text-link" to={activeDeliveries.length ? '/volunteer/deliveries' : '/volunteer/tasks'}>
                  {activeDeliveries.length ? 'All assignments' : 'All open tasks'} <ArrowRight aria-hidden="true" />
                </Link>
              </div>
              {featuredDelivery ? (
                <>
                  <VolunteerRouteMap deliveryId={featuredDelivery._id} />
                  <div className="volunteer-featured-task">
                    <span className="volunteer-task-icon"><MapPin aria-hidden="true" /></span>
                    <div><small>{activeDeliveries.length ? 'In progress' : 'Available task'}</small><strong>{featuredDelivery.reservation?.foodListing?.title || 'Food collection'}</strong></div>
                    <span className="volunteer-featured-task-actions">
                      {activeDeliveries.length > 0 && <Button to="/volunteer/verification" size="small">QR verification</Button>}
                      <Button to={`/volunteer/tasks/${featuredDelivery._id}`} size="small" variant="secondary">{activeDeliveries.length ? 'Open task' : 'Review task'}</Button>
                    </span>
                  </div>
                </>
              ) : (
                <div className="volunteer-no-route">
                  <span><MapPin aria-hidden="true" /></span>
                  <strong>No route is assigned yet.</strong>
                  <p>When a delivery is ready for volunteers, its pickup and destination will appear here.</p>
                  <Button to="/volunteer/tasks" size="small">Browse delivery tasks</Button>
                </div>
              )}
            </section>

            <aside className="volunteer-right-rail">
              <section className="volunteer-activity-panel">
                <div className="editorial-section-heading">
                  <div><span className="provider-panel-kicker">Your work</span><h2>Delivery timeline</h2></div>
                  <Link className="editorial-icon-link" to="/volunteer/deliveries" aria-label="View all deliveries"><ArrowRight aria-hidden="true" /></Link>
                </div>
                {activeDeliveries.length ? (
                  <div className="volunteer-card-list">
                    {activeDeliveries.slice(0, 2).map((delivery) => (
                      <VolunteerDeliveryCard delivery={delivery} key={delivery._id} />
                    ))}
                  </div>
                ) : (
                  <ProviderState title="No active deliveries" description="Accept a task to start your first food handoff." />
                )}
              </section>

              <section className="volunteer-updates-panel">
                <div className="editorial-section-heading">
                  <div><span className="provider-panel-kicker">Dispatch notes</span><h2>Recent updates</h2></div>
                  <Link className="editorial-icon-link" to="/volunteer/notifications" aria-label="Open notification inbox"><ArrowRight aria-hidden="true" /></Link>
                </div>
                {notifications.length ? (
                  <div className="volunteer-notification-list">
                    {notifications.slice(0, 3).map((notification) => (
                      <article className={`volunteer-notification${notification.isRead ? '' : ' is-unread'}`} key={notification._id}>
                        <div className="volunteer-notification-heading"><strong>{notification.title}</strong><span className="provider-status">{formatLabel(notification.type || 'update')}</span></div>
                        <p>{notification.message}</p>
                        <div className="volunteer-notification-footer">
                          <time dateTime={notification.createdAt}><Clock3 aria-hidden="true" /> {formatDate(notification.createdAt)}</time>
                          {!notification.isRead && (
                            <button className="volunteer-text-button" disabled={busyId === notification._id} onClick={() => markAsRead(notification._id)} type="button">
                              {busyId === notification._id ? 'Saving…' : 'Mark read'}
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <ProviderState title="All caught up" description="Delivery assignments and important updates will appear here." />
                )}
              </section>
            </aside>
          </div>
        </>
      )}
      {!loading && error && <ProviderState type="error" title="Dashboard data may be incomplete" description="Refresh to retry the unavailable volunteer information." onRetry={() => { setLoading(true); setError(''); setReloadKey((key) => key + 1) }} />}
    </div>
  )
}

export default VolunteerOverviewPage

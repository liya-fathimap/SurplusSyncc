import { useCallback, useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import useRealtimeEvent from '../../hooks/useRealtimeEvent.js'
import VolunteerPageHeader from '../../components/volunteer/VolunteerPageHeader.jsx'
import { formatDate, formatLabel } from '../../utils/providerFormat.js'
import { getVolunteerApiError, getVolunteerNotifications, markVolunteerNotificationRead } from '../../services/volunteerService.js'

function VolunteerNotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    try {
      const result = await getVolunteerNotifications({
        page,
        limit: 10,
        ...(filter === 'unread' ? { isRead: false } : {}),
      })
      setNotifications(result.notifications || [])
      setPagination(result.pagination || { total: 0, totalPages: 0 })
      setError('')
    } catch (requestError) {
      setError(getVolunteerApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useRealtimeEvent('notification:new', () => { void load() })

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

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

  return (
    <div className="provider-page volunteer-page">
      <VolunteerPageHeader title="Notifications" description="Delivery assignments and important updates for your volunteer account." />
      {actionError && <div className="provider-alert" role="alert">{actionError}</div>}
      <Card className="provider-panel">
        <div className="provider-panel-heading">
          <div><span className="provider-panel-kicker">Inbox</span><h2><Bell aria-hidden="true" /> Volunteer updates</h2></div>
          <label className="volunteer-notification-filter">
            <span className="sr-only">Filter notifications</span>
            <select onChange={(event) => { setFilter(event.target.value); setPage(1); setLoading(true) }} value={filter}>
              <option value="all">All notifications</option>
              <option value="unread">Unread only</option>
            </select>
          </label>
        </div>
        {loading ? (
          <div className="provider-loading"><Loading label="Loading notifications…" /></div>
        ) : error ? (
          <ProviderState type="error" title="Notifications are unavailable" description={error} onRetry={() => { setLoading(true); void Promise.resolve().then(load) }} />
        ) : notifications.length ? (
          <>
            <div className="volunteer-notification-list">
              {notifications.map((notification) => (
                <article className={`volunteer-notification${notification.isRead ? '' : ' is-unread'}`} key={notification._id}>
                  <div className="volunteer-notification-heading">
                    <strong>{notification.title}</strong>
                    <span className="provider-status">{formatLabel(notification.type || 'update')}</span>
                  </div>
                  <p>{notification.message}</p>
                  <div className="volunteer-notification-footer">
                    <time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time>
                    {!notification.isRead && (
                      <button className="volunteer-text-button" disabled={busyId === notification._id} onClick={() => markAsRead(notification._id)} type="button">
                        <Check aria-hidden="true" /> {busyId === notification._id ? 'Saving…' : 'Mark read'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <div className="provider-pagination">
              <span>{pagination.total} notification{pagination.total === 1 ? '' : 's'} · Page {page} of {Math.max(pagination.totalPages, 1)}</span>
              <div>
                <button className="button button-secondary button-small" disabled={page <= 1} onClick={() => { setPage((current) => current - 1); setLoading(true) }} type="button">Previous</button>
                <button className="button button-secondary button-small" disabled={page >= pagination.totalPages} onClick={() => { setPage((current) => current + 1); setLoading(true) }} type="button">Next</button>
              </div>
            </div>
          </>
        ) : (
          <ProviderState title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} description="Delivery updates sent to your account will appear here." />
        )}
      </Card>
    </div>
  )
}

export default VolunteerNotificationsPage

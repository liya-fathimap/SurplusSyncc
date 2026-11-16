import { useCallback, useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import useRealtimeEvent from '../../hooks/useRealtimeEvent.js'
import { getNgoApiError, getNgoNotifications, markNgoNotificationRead } from '../../services/ngoService.js'
import { formatDate, formatLabel } from '../../utils/providerFormat.js'

const pageSize = 10

function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    try {
      const result = await getNgoNotifications({
        page,
        limit: pageSize,
        ...(filter === 'unread' ? { isRead: false } : {}),
      })
      setNotifications(result.notifications || [])
      setPagination(result.pagination || { total: 0, totalPages: 0 })
      setError('')
    } catch (requestError) {
      setError(getNgoApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useRealtimeEvent('notification:new', () => { void load() })

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  function changeFilter(event) {
    setFilter(event.target.value)
    setPage(1)
    setLoading(true)
  }

  async function markAsRead(notificationId) {
    setBusyId(notificationId)
    setError('')
    try {
      await markNgoNotificationRead(notificationId)
      await load()
    } catch (requestError) {
      setError(getNgoApiError(requestError))
    } finally {
      setBusyId('')
    }
  }

  function retry() {
    setLoading(true)
    void Promise.resolve().then(load)
  }

  return (
    <div className="provider-page">
      <ProviderPageHeader
        eyebrow="Updates"
        title="Notifications"
        description="Stay up to date about reservation decisions, collection changes, and completed deliveries."
      />
      <Card className="provider-panel">
        <div className="provider-panel-heading">
          <div><span className="provider-panel-kicker">Inbox</span><h2><Bell aria-hidden="true" /> Recent updates</h2></div>
          <label className="ngo-status-filter">
            <span className="sr-only">Filter notifications</span>
            <select onChange={changeFilter} value={filter}>
              <option value="all">All notifications</option>
              <option value="unread">Unread only</option>
            </select>
          </label>
        </div>
        {error ? (
          <ProviderState type="error" title="Notifications unavailable" description={error} onRetry={retry} />
        ) : loading ? (
          <div className="provider-loading"><Loading label="Loading notifications…" /></div>
        ) : notifications.length ? (
          <>
            <div className="ngo-notification-list">
              {notifications.map((notification) => (
                <article className={`ngo-notification${notification.isRead ? '' : ' is-unread'}`} key={notification._id}>
                  <span className="provider-list-icon"><Bell aria-hidden="true" /></span>
                  <div className="ngo-notification-content">
                    <div className="ngo-notification-heading">
                      <strong>{notification.title}</strong>
                      <span className="provider-status">{formatLabel(notification.type)}</span>
                    </div>
                    <p>{notification.message}</p>
                    <time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time>
                  </div>
                  {!notification.isRead && (
                    <button
                      aria-label={`Mark ${notification.title} as read`}
                      className="button button-secondary button-small"
                      disabled={busyId === notification._id}
                      onClick={() => markAsRead(notification._id)}
                      type="button"
                    >
                      <Check aria-hidden="true" /> {busyId === notification._id ? 'Saving…' : 'Mark read'}
                    </button>
                  )}
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
          <ProviderState
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description="Updates about your food requests and collections will be stored here."
          />
        )}
      </Card>
    </div>
  )
}

export default NotificationsPage

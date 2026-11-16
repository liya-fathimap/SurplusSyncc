import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Building2, CircleX } from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import { getAdminApiError, getAdminUsers, setAdminVerification } from '../../services/adminService.js'
import { formatDate } from '../../utils/providerFormat.js'

const pageSize = 10

function VerificationQueuePage({ role, title }) {
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const result = await getAdminUsers({
        page,
        limit: pageSize,
        role,
        verificationStatus: status,
      })
      setUsers(result.users || [])
      setPagination(result.pagination || { total: 0, totalPages: 0 })
      setError('')
    } catch (requestError) {
      setError(getAdminApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [page, role, status])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  async function decide(userId, decision) {
    setBusyId(userId)
    setActionMessage('')
    setError('')
    try {
      await setAdminVerification(userId, decision)
      setActionMessage(`Verification ${decision === 'approve' ? 'approved' : 'rejected'}.`)
      await load()
    } catch (requestError) {
      setError(getAdminApiError(requestError))
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="provider-page admin-page">
      <ProviderPageHeader
        eyebrow="Organization review"
        title={title}
        description={`Review real ${role === 'ngo' ? 'NGO' : 'provider'} verification requests and record an approval or rejection.`}
      />
      {actionMessage && <div className="provider-success" role="status">{actionMessage}</div>}
      <Card className="provider-panel">
        <div className="provider-panel-heading">
          <div><span className="provider-panel-kicker">Verification requests</span><h2><Building2 aria-hidden="true" /> {title}</h2></div>
          <label className="admin-filter">
            <span className="sr-only">Filter verification status</span>
            <select onChange={(event) => { setStatus(event.target.value); setPage(1); setLoading(true) }} value={status}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        </div>
        {error ? (
          <ProviderState type="error" title="Verification requests unavailable" description={error} onRetry={() => { setLoading(true); void Promise.resolve().then(load) }} />
        ) : loading ? (
          <div className="provider-loading"><Loading label="Loading verification requests…" /></div>
        ) : users.length ? (
          <>
            <div className="admin-record-list">
              {users.map((user) => (
                <article className="admin-record" key={user._id}>
                  <div className="admin-record-main">
                    <span className="provider-list-icon"><Building2 aria-hidden="true" /></span>
                    <div><strong>{user.organizationName || user.name}</strong><small>{user.name} · {user.email}</small><small>Registered {formatDate(user.createdAt)}</small></div>
                    <span className={`provider-status status-${user.verificationStatus || (user.isVerified ? 'approved' : 'pending')}`}>
                      {user.verificationStatus || (user.isVerified ? 'approved' : 'pending')}
                    </span>
                  </div>
                  <div className="admin-record-actions">
                    <Button disabled={busyId === user._id || user.verificationStatus === 'approved' || (!user.verificationStatus && user.isVerified)} onClick={() => decide(user._id, 'approve')} size="small">
                      <BadgeCheck aria-hidden="true" /> Approve
                    </Button>
                    <Button disabled={busyId === user._id || user.verificationStatus === 'rejected'} onClick={() => decide(user._id, 'reject')} size="small" variant="secondary">
                      <CircleX aria-hidden="true" /> Reject
                    </Button>
                  </div>
                </article>
              ))}
            </div>
            <div className="provider-pagination">
              <span>{pagination.total} organizations · Page {page} of {Math.max(pagination.totalPages, 1)}</span>
              <div>
                <button className="button button-secondary button-small" disabled={page <= 1} onClick={() => { setPage((value) => value - 1); setLoading(true) }} type="button">Previous</button>
                <button className="button button-secondary button-small" disabled={page >= pagination.totalPages} onClick={() => { setPage((value) => value + 1); setLoading(true) }} type="button">Next</button>
              </div>
            </div>
          </>
        ) : (
          <ProviderState title={`No ${status} requests`} description="Requests matching this status will appear here." />
        )}
      </Card>
    </div>
  )
}

export default VerificationQueuePage

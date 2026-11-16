import { useCallback, useEffect, useState } from 'react'
import { Power, RefreshCw, Users } from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import { getAdminApiError, getAdminUsers, setAdminUserActive } from '../../services/adminService.js'
import { formatDate, formatLabel } from '../../utils/providerFormat.js'

const pageSize = 15

function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState({ role: '', verificationStatus: '', active: '' })
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const result = await getAdminUsers({
        page,
        limit: pageSize,
        ...(filters.role ? { role: filters.role } : {}),
        ...(filters.verificationStatus ? { verificationStatus: filters.verificationStatus } : {}),
        ...(filters.active ? { active: filters.active } : {}),
      })
      setUsers(result.users || [])
      setPagination(result.pagination || { total: 0, totalPages: 0 })
      setError('')
    } catch (requestError) {
      setError(getAdminApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  function updateFilter(event) {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(1)
    setLoading(true)
  }

  async function toggleActive(user) {
    setBusyId(user._id)
    setNotice('')
    setError('')
    try {
      await setAdminUserActive(user._id, !user.isActive)
      setNotice(`${user.name} was ${user.isActive ? 'deactivated' : 'activated'}.`)
      await load()
    } catch (requestError) {
      setError(getAdminApiError(requestError))
    } finally {
      setBusyId('')
    }
  }

  function retry() {
    setLoading(true)
    void Promise.resolve().then(load)
  }

  return (
    <div className="provider-page admin-page">
      <ProviderPageHeader
        eyebrow="Accounts"
        title="User management"
        description="Review registered accounts, apply role and verification filters, and control account access."
        actions={<Button onClick={retry} variant="secondary"><RefreshCw aria-hidden="true" /> Refresh</Button>}
      />
      {notice && <div className="provider-success" role="status">{notice}</div>}
      <Card className="provider-panel">
        <div className="provider-panel-heading">
          <div><span className="provider-panel-kicker">Registered accounts</span><h2><Users aria-hidden="true" /> Users</h2></div>
          <div className="admin-filter-row">
            <label className="admin-filter"><span className="sr-only">Filter by role</span>
              <select name="role" onChange={updateFilter} value={filters.role}>
                <option value="">All roles</option>
                {['provider', 'ngo', 'volunteer', 'admin'].map((role) => <option key={role} value={role}>{formatLabel(role)}</option>)}
              </select>
            </label>
            <label className="admin-filter"><span className="sr-only">Filter verification</span>
              <select name="verificationStatus" onChange={updateFilter} value={filters.verificationStatus}>
                <option value="">Any verification status</option>
                {['pending', 'approved', 'rejected', 'not_required'].map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
              </select>
            </label>
            <label className="admin-filter"><span className="sr-only">Filter account activity</span>
              <select name="active" onChange={updateFilter} value={filters.active}>
                <option value="">Active and inactive</option>
                <option value="true">Active only</option>
                <option value="false">Inactive only</option>
              </select>
            </label>
          </div>
        </div>
        {error ? (
          <ProviderState type="error" title="User records unavailable" description={error} onRetry={retry} />
        ) : loading ? (
          <div className="provider-loading"><Loading label="Loading registered users…" /></div>
        ) : users.length ? (
          <>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead><tr><th>User</th><th>Role</th><th>Verification</th><th>Account</th><th>Joined</th><th>Action</th></tr></thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id}>
                      <td><strong>{user.organizationName || user.name}</strong><small>{user.name} · {user.email}</small></td>
                      <td>{formatLabel(user.role)}</td>
                      <td><span className={`provider-status status-${user.verificationStatus || (user.isVerified ? 'approved' : 'pending')}`}>{formatLabel(user.verificationStatus || (user.isVerified ? 'approved' : 'pending'))}</span></td>
                      <td><span className={`provider-status status-${user.isActive ? 'available' : 'cancelled'}`}>{user.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td>{formatDate(user.createdAt, { timeStyle: undefined })}</td>
                      <td><Button disabled={busyId === user._id || (user.role === 'admin' && user.isActive)} onClick={() => toggleActive(user)} size="small" variant={user.isActive ? 'secondary' : 'primary'}><Power aria-hidden="true" /> {busyId === user._id ? 'Saving…' : user.isActive ? 'Deactivate' : 'Activate'}</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="provider-pagination">
              <span>{pagination.total} users · Page {page} of {Math.max(pagination.totalPages, 1)}</span>
              <div>
                <button className="button button-secondary button-small" disabled={page <= 1} onClick={() => { setPage((value) => value - 1); setLoading(true) }} type="button">Previous</button>
                <button className="button button-secondary button-small" disabled={page >= pagination.totalPages} onClick={() => { setPage((value) => value + 1); setLoading(true) }} type="button">Next</button>
              </div>
            </div>
          </>
        ) : (
          <ProviderState title="No users match these filters" description="Try changing the role, verification, or active status." />
        )}
      </Card>
    </div>
  )
}

export default AdminUsersPage

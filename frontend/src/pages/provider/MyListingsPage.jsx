import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, PackagePlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Loading from '../../components/common/Loading.jsx'
import Card from '../../components/common/Card.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import {
  getProviderApiError,
  getProviderListings,
} from '../../services/providerService.js'
import { formatDate, formatLabel, getListingState, getReservedQuantity } from '../../utils/providerFormat.js'

const filters = [
  ['all', 'All listings'],
  ['available', 'Available'],
  ['partially_reserved', 'Partially reserved'],
  ['fully_reserved', 'Fully reserved'],
  ['expired', 'Expired'],
  ['cancelled', 'Cancelled'],
]

function MyListingsPage() {
  const [listings, setListings] = useState([])
  const [pagination, setPagination] = useState(null)
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const result = await getProviderListings({
        page,
        limit: 10,
        sort: 'newest',
        ...(status !== 'all' ? { status } : {}),
      })
      setListings(result.listings || [])
      setPagination(result.pagination || null)
    } catch (requestError) {
      setError(getProviderApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load, reloadKey])

  function changeStatus(event) {
    setLoading(true)
    setError('')
    setPage(1)
    setStatus(event.target.value)
  }

  function retry() {
    setLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="provider-page">
      <ProviderPageHeader
        eyebrow="Food inventory"
        title="My food listings"
        description="Review availability, reservation quantities, and collection deadlines."
        actions={<Button to="/provider/listings/new"><PackagePlus aria-hidden="true" /> New listing</Button>}
      />

      <div className="provider-toolbar">
        <label className="provider-filter">
          <span>Status</span>
          <select onChange={changeStatus} value={status}>
            {filters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {pagination && <span className="provider-result-count">{pagination.total} listings</span>}
      </div>

      <Card className="provider-panel provider-table-panel">
        {loading ? (
          <div className="provider-loading"><Loading label="Loading your listings…" /></div>
        ) : error ? (
          <ProviderState type="error" description={error} onRetry={retry} />
        ) : listings.length ? (
          <>
            <div className="provider-table-scroll">
              <table className="provider-table">
                <thead>
                  <tr>
                    <th>Food listing</th>
                    <th>Status</th>
                    <th>Available</th>
                    <th>Reserved</th>
                    <th>Collection deadline</th>
                    <th><span className="sr-only">Open details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((listing) => {
                    const listingState = getListingState(listing)
                    return (
                      <tr key={listing._id}>
                        <td>
                          <span className="provider-table-title">{listing.title}</span>
                          <small>{listing.foodCategory} · {listing.quantity} {listing.unit} total</small>
                        </td>
                        <td><span className={`provider-status status-${listingState}`}>{formatLabel(listingState)}</span></td>
                        <td>{listing.availableQuantity} {listing.unit}</td>
                        <td>{getReservedQuantity(listing)} {listing.unit}</td>
                        <td>{formatDate(listing.collectionDeadline)}</td>
                        <td>
                          <Link className="provider-icon-link" to={`/provider/listings/${listing._id}`} aria-label={`View ${listing.title}`}>
                            <ArrowRight aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="provider-pagination">
              <span>Page {pagination?.page || page} of {Math.max(1, pagination?.totalPages || 1)}</span>
              <div>
                <Button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} size="small" variant="secondary">Previous</Button>
                <Button disabled={!pagination || page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} size="small" variant="secondary">Next</Button>
              </div>
            </div>
          </>
        ) : (
          <ProviderState
            title={status === 'all' ? 'No food listings yet' : `No ${formatLabel(status).toLowerCase()} listings`}
            description="Create a food listing to start sharing surplus with your community."
            action={<Button to="/provider/listings/new" size="small">Create listing</Button>}
          />
        )}
      </Card>
    </div>
  )
}

export default MyListingsPage

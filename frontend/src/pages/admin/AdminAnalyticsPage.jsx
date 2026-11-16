import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Building2, PackageCheck } from 'lucide-react'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import {
  getAdminApiError,
  getAdminCategories,
  getAdminMonthly,
  getAdminProviderPerformance,
} from '../../services/adminService.js'

function AdminAnalyticsPage() {
  const [monthly, setMonthly] = useState([])
  const [categories, setCategories] = useState([])
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [monthlyResult, categoryResult, providerResult] = await Promise.all([
        getAdminMonthly(12),
        getAdminCategories(),
        getAdminProviderPerformance(),
      ])
      setMonthly(monthlyResult.statistics || [])
      setCategories(categoryResult.categories || [])
      setProviders(providerResult.providers || [])
      setError('')
    } catch (requestError) {
      setError(getAdminApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  return (
    <div className="provider-page admin-page">
      <ProviderPageHeader
        eyebrow="Platform impact"
        title="Platform analytics"
        description="Review completed redistribution quantities by month and unit, food category, and provider."
      />
      {error ? (
        <ProviderState type="error" title="Platform analytics unavailable" description={error} onRetry={() => { setLoading(true); void Promise.resolve().then(load) }} />
      ) : loading ? (
        <div className="provider-loading"><Loading label="Loading platform analytics…" /></div>
      ) : (
        <>
          <div className="provider-dashboard-grid">
            <Card className="provider-panel">
              <div className="provider-panel-heading"><div><span className="provider-panel-kicker">Completed reservations</span><h2><BarChart3 aria-hidden="true" /> Monthly redistribution</h2></div></div>
              {monthly.length ? (
                <div className="admin-table-scroll">
                  <table className="admin-table"><thead><tr><th>Month</th><th>Quantity</th><th>Completed reservations</th></tr></thead>
                    <tbody>{monthly.map((item) => <tr key={`${item.month}-${item.unit}`}><td>{item.month}</td><td>{Number(item.quantityRedistributed).toLocaleString()} {item.unit}</td><td>{item.completedReservations}</td></tr>)}</tbody>
                  </table>
                </div>
              ) : <ProviderState title="No monthly redistribution yet" description="Monthly data appears after completed reservations." />}
            </Card>
            <Card className="provider-panel">
              <div className="provider-panel-heading"><div><span className="provider-panel-kicker">By category</span><h2><PackageCheck aria-hidden="true" /> Food category totals</h2></div></div>
              {categories.length ? (
                <div className="admin-table-scroll">
                  <table className="admin-table"><thead><tr><th>Category</th><th>Unit</th><th>Listed</th><th>Redistributed</th></tr></thead>
                    <tbody>{categories.map((item) => <tr key={`${item.category}-${item.unit}`}><td>{item.category}</td><td>{item.unit}</td><td>{Number(item.quantityListed || 0).toLocaleString()}</td><td>{Number(item.quantityRedistributed || 0).toLocaleString()}</td></tr>)}</tbody>
                  </table>
                </div>
              ) : <ProviderState title="No category data" description="Food category statistics will appear here." />}
            </Card>
          </div>
          <Card className="provider-panel admin-provider-performance">
            <div className="provider-panel-heading"><div><span className="provider-panel-kicker">Provider performance</span><h2><Building2 aria-hidden="true" /> Redistribution by provider</h2></div></div>
            {providers.length ? (
              <div className="admin-table-scroll">
                <table className="admin-table"><thead><tr><th>Provider</th><th>Unit</th><th>Listed</th><th>Redistributed</th><th>Completed reservations</th><th>Active listings</th></tr></thead>
                  <tbody>{providers.flatMap((provider) => (provider.quantitiesByUnit || []).map((quantity) => (
                    <tr key={`${provider.providerId}-${quantity.unit}`}>
                      <td><strong>{provider.organizationName || provider.providerName || 'Provider'}</strong></td>
                      <td>{quantity.unit}</td>
                      <td>{Number(quantity.quantityListed).toLocaleString()}</td>
                      <td>{Number(quantity.quantityRedistributed).toLocaleString()}</td>
                      <td>{provider.completedReservations}</td>
                      <td>{provider.activeFoodListings}</td>
                    </tr>
                  )))}</tbody>
                </table>
              </div>
            ) : <ProviderState title="No provider performance yet" description="Provider performance appears when listings and completed reservations exist." />}
          </Card>
          <div className="provider-data-note">Measured food quantities are grouped by their unit and completed reservations only. Environmental impact estimates are kept separate and are not inferred from these measurements.</div>
        </>
      )}
    </div>
  )
}

export default AdminAnalyticsPage

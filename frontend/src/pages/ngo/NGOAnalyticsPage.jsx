import { useCallback, useEffect, useState } from 'react'
import { ChartNoAxesCombined, ClipboardList, PackageCheck, Truck } from 'lucide-react'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import ProviderStatCard from '../../components/provider/ProviderStatCard.jsx'
import {
  getNgoApiError,
  getNgoCategories,
  getNgoMonthly,
  getNgoOverview,
} from '../../services/ngoService.js'
import { formatQuantities } from '../../utils/providerFormat.js'

function NGOAnalyticsPage() {
  const [overview, setOverview] = useState(null)
  const [monthly, setMonthly] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [overviewResult, monthlyResult, categoryResult] = await Promise.all([
        getNgoOverview(),
        getNgoMonthly(12),
        getNgoCategories(),
      ])
      setOverview(overviewResult)
      setMonthly(monthlyResult.statistics || [])
      setCategories(categoryResult.categories || [])
      setError('')
    } catch (requestError) {
      setError(getNgoApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  function retry() {
    setLoading(true)
    void Promise.resolve().then(load)
  }

  return (
    <div className="provider-page">
      <ProviderPageHeader
        eyebrow="Measured impact"
        title="NGO impact analytics"
        description="Track quantities from completed collections and reservation records. Quantities are grouped by their original unit."
      />
      {error ? (
        <ProviderState type="error" title="Impact data unavailable" description={error} onRetry={retry} />
      ) : loading ? (
        <div className="provider-loading"><Loading label="Loading your impact reports…" /></div>
      ) : overview ? (
        <>
          <div className="provider-stats-grid">
            <ProviderStatCard icon={PackageCheck} label="Food collected" loading={false} value={formatQuantities(overview.totalFoodQuantityCollected)} />
            <ProviderStatCard icon={ClipboardList} label="Completed reservations" loading={false} value={overview.completedReservations ?? 0} />
            <ProviderStatCard icon={Truck} label="Successful deliveries" loading={false} value={overview.successfulDeliveries ?? 0} />
            <ProviderStatCard icon={ChartNoAxesCombined} label="Pending reservations" loading={false} value={overview.pendingReservations ?? 0} />
          </div>

          <div className="provider-dashboard-grid">
            <Card className="provider-panel">
              <div className="provider-panel-heading">
                <div><span className="provider-panel-kicker">By completion month</span><h2>Monthly collection history</h2></div>
              </div>
              {monthly.length ? (
                <div className="ngo-analytics-table-wrap">
                  <table className="ngo-analytics-table">
                    <thead><tr><th>Month</th><th>Collected</th><th>Completed requests</th></tr></thead>
                    <tbody>
                      {monthly.map((item) => (
                        <tr key={`${item.month}-${item.unit}`}>
                          <td>{item.month}</td>
                          <td>{Number(item.quantityRedistributed).toLocaleString()} {item.unit}</td>
                          <td>{item.completedReservations}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ProviderState title="No completed collections yet" description="Monthly measured quantities will appear after a collection is completed." />
              )}
            </Card>

            <Card className="provider-panel">
              <div className="provider-panel-heading">
                <div><span className="provider-panel-kicker">By food type</span><h2>Collected food categories</h2></div>
              </div>
              {categories.length ? (
                <div className="provider-list">
                  {categories.map((item) => (
                    <div className="provider-list-row" key={`${item.category}-${item.unit}`}>
                      <span className="provider-list-icon"><PackageCheck aria-hidden="true" /></span>
                      <span className="provider-list-main">
                        <strong>{item.category}</strong>
                        <small>{item.completedReservations} completed reservation{item.completedReservations === 1 ? '' : 's'}</small>
                      </span>
                      <span className="provider-list-amount">
                        {Number(item.quantityRedistributed).toLocaleString()} {item.unit}
                        <small>collected</small>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <ProviderState title="No category data yet" description="Category totals appear after successfully completed collections." />
              )}
            </Card>
          </div>

          <Card className="provider-panel ngo-impact-note">
            <div className="provider-panel-heading"><h2>Environmental impact estimates</h2></div>
            <p>
              {overview.environmentalImpact?.status === 'not_calculated'
                ? overview.environmentalImpact.reason
                : 'No environmental estimate is currently available.'}
            </p>
            <p className="provider-data-note">
              Food quantities above are measured reservation quantities, not environmental estimates. SurplusSync does not apply assumed emissions, water, or meal conversion factors to these reports.
            </p>
          </Card>
          <p className="provider-data-note">Measured quantities include completed reservations only and remain separated by unit to avoid misleading totals.</p>
        </>
      ) : null}
    </div>
  )
}

export default NGOAnalyticsPage

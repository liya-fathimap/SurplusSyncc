import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChartNoAxesCombined, PackageCheck, PackageSearch, Truck } from 'lucide-react'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import ProviderStatCard from '../../components/provider/ProviderStatCard.jsx'
import {
  getProviderApiError,
  getProviderCategories,
  getProviderMonthly,
  getProviderOverview,
} from '../../services/providerService.js'
import { formatQuantities } from '../../utils/providerFormat.js'

function ProviderAnalyticsPage() {
  const [data, setData] = useState(null)
  const [monthly, setMonthly] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const [overview, monthlyResult, categoryResult] = await Promise.all([
        getProviderOverview(),
        getProviderMonthly(12),
        getProviderCategories(),
      ])
      setData(overview)
      setMonthly(monthlyResult.statistics || [])
      setCategories(categoryResult.categories || [])
    } catch (requestError) {
      setError(getProviderApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load, reloadKey])

  function refresh() {
    setLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  const unitGroups = useMemo(() => {
    const groups = new Map()
    for (const row of monthly) {
      if (!groups.has(row.unit)) groups.set(row.unit, [])
      groups.get(row.unit).push(row)
    }
    return [...groups.entries()]
  }, [monthly])

  return (
    <div className="provider-page">
      <ProviderPageHeader
        eyebrow="Your impact"
        title="Provider analytics"
        description="Track listed food, completed redistribution, and delivery activity from your account."
        actions={<button className="button button-secondary button-medium" onClick={refresh} type="button"><ChartNoAxesCombined aria-hidden="true" /> Refresh reports</button>}
      />
      {error ? (
        <ProviderState type="error" description={error} onRetry={refresh} />
      ) : loading ? (
        <div className="provider-loading"><Loading label="Loading your analytics…" /></div>
      ) : data ? (
        <>
          <div className="provider-stats-grid">
            <ProviderStatCard icon={PackageSearch} label="Active listings" loading={false} value={data.activeFoodListings ?? 0} />
            <ProviderStatCard icon={PackageCheck} label="Food quantity listed" loading={false} value={formatQuantities(data.totalFoodQuantityListed)} />
            <ProviderStatCard icon={PackageCheck} label="Successfully redistributed" loading={false} value={formatQuantities(data.totalFoodQuantityRedistributed)} />
            <ProviderStatCard icon={Truck} label="Successful deliveries" loading={false} value={data.successfulDeliveries ?? 0} />
          </div>

          <div className="provider-dashboard-grid">
            <Card className="provider-panel">
              <div className="provider-panel-heading">
                <div><span className="provider-panel-kicker">Completed reservations</span><h2>Monthly redistribution</h2></div>
              </div>
              {unitGroups.length ? (
                    <div className="provider-unit-charts">
                      {unitGroups.map(([unit, rows]) => {
                        const maxUnitQuantity = Math.max(
                          1,
                          ...rows.map((row) => Number(row.quantityRedistributed) || 0),
                        )
                        return (
                          <div className="provider-unit-chart" key={unit}>
                            <strong>Redistributed ({unit})</strong>
                            <div className="provider-month-chart">
                              {rows.map((row) => (
                                <div className="provider-month-group" key={`${row.month}-${unit}`}>
                                  <div className="provider-month-bars">
                                    <div className="provider-month-unit" title={`${row.quantityRedistributed} ${unit}`}>
                                      <span
                                        className="provider-month-bar"
                                        style={{ height: `${Math.max(5, (Number(row.quantityRedistributed) / maxUnitQuantity) * 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                  <span className="provider-month-label">{row.month}</span>
                                  <small>{Number(row.quantityRedistributed).toLocaleString()} {unit}</small>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
              ) : (
                <ProviderState title="No completed redistribution yet" description="Monthly totals will appear after reservations are completed." />
              )}
            </Card>

            <Card className="provider-panel">
              <div className="provider-panel-heading">
                <div><span className="provider-panel-kicker">Food inventory</span><h2>Category distribution</h2></div>
              </div>
              {categories.length ? (
                <div className="provider-category-list">
                  {categories.map((category) => (
                    <div className="provider-category-row" key={`${category.category}-${category.unit}`}>
                      <span><strong>{category.category}</strong><small>{category.unit} · {category.completedReservations} completed requests</small></span>
                      <span>
                        <strong>{Number(category.quantityRedistributed || 0).toLocaleString()} {category.unit}</strong>
                        <small>{Number(category.quantityListed || 0).toLocaleString()} listed</small>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <ProviderState title="No category data yet" description="Category totals will appear when listings are available." />
              )}
            </Card>
          </div>
          <p className="provider-data-note">
            Quantities are grouped by their unit and only completed reservations count as redistributed. Environmental impact estimates are not calculated unless approved conversion factors are configured.
          </p>
        </>
      ) : null}
    </div>
  )
}

export default ProviderAnalyticsPage

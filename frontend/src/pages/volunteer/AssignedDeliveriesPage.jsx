import { useCallback, useEffect, useState } from 'react'
import { ListChecks } from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import useRealtimeEvent from '../../hooks/useRealtimeEvent.js'
import VolunteerDeliveryCard from '../../components/volunteer/VolunteerDeliveryCard.jsx'
import VolunteerPageHeader from '../../components/volunteer/VolunteerPageHeader.jsx'
import { getVolunteerApiError, getVolunteerDeliveries } from '../../services/volunteerService.js'

function AssignedDeliveriesPage() {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const result = await getVolunteerDeliveries()
      setDeliveries((result.deliveries || []).filter((delivery) => (
        ['assigned', 'accepted', 'picked_up', 'in_transit'].includes(delivery.status)
      )))
      setError('')
    } catch (requestError) {
      setError(getVolunteerApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useRealtimeEvent('delivery:updated', () => { void load() })

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load, reloadKey])

  function refresh() {
    setLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="provider-page volunteer-page">
      <VolunteerPageHeader
        title="Assigned deliveries"
        description="Your accepted and in-progress deliveries, with current status and collection details."
        actions={<Button onClick={refresh} variant="secondary"><ListChecks aria-hidden="true" /> Refresh</Button>}
      />
      <Card className="provider-panel">
        {loading ? (
          <div className="provider-loading"><Loading label="Loading assigned deliveries…" /></div>
        ) : error ? (
          <ProviderState type="error" title="Assigned deliveries are unavailable" description={error} onRetry={refresh} />
        ) : deliveries.length ? (
          <div className="volunteer-card-list">
            {deliveries.map((delivery) => <VolunteerDeliveryCard delivery={delivery} key={delivery._id} />)}
          </div>
        ) : (
          <ProviderState title="No assigned deliveries" description="Once you accept a task, it will appear here until it is completed." action={<Button to="/volunteer/tasks" size="small">Find a delivery</Button>} />
        )}
      </Card>
    </div>
  )
}

export default AssignedDeliveriesPage

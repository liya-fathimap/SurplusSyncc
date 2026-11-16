import { useCallback, useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import VolunteerDeliveryCard from '../../components/volunteer/VolunteerDeliveryCard.jsx'
import VolunteerPageHeader from '../../components/volunteer/VolunteerPageHeader.jsx'
import { getVolunteerApiError, getVolunteerDeliveries } from '../../services/volunteerService.js'

function DeliveryHistoryPage() {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const result = await getVolunteerDeliveries()
      setDeliveries((result.deliveries || []).filter((delivery) => (
        ['delivered', 'failed', 'cancelled'].includes(delivery.status)
      )))
      setError('')
    } catch (requestError) {
      setError(getVolunteerApiError(requestError))
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

  return (
    <div className="provider-page volunteer-page">
      <VolunteerPageHeader
        title="Delivery history"
        description="Completed, failed, and cancelled deliveries assigned to your volunteer account."
        actions={<Button onClick={refresh} variant="secondary"><Clock3 aria-hidden="true" /> Refresh</Button>}
      />
      <Card className="provider-panel">
        {loading ? (
          <div className="provider-loading"><Loading label="Loading delivery history…" /></div>
        ) : error ? (
          <ProviderState type="error" title="Delivery history is unavailable" description={error} onRetry={refresh} />
        ) : deliveries.length ? (
          <div className="volunteer-card-list">
            {deliveries.map((delivery) => <VolunteerDeliveryCard delivery={delivery} key={delivery._id} />)}
          </div>
        ) : (
          <ProviderState title="No delivery history yet" description="Once a delivery is completed or closed, it will appear here." action={<Button to="/volunteer/tasks" size="small">Browse tasks</Button>} />
        )}
      </Card>
    </div>
  )
}

export default DeliveryHistoryPage

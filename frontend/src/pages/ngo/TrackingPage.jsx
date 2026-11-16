import { useCallback, useEffect, useState } from 'react'
import Loading from '../../components/common/Loading.jsx'
import NGODeliveryCard from '../../components/ngo/NGODeliveryCard.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import useRealtimeEvent from '../../hooks/useRealtimeEvent.js'
import { getNgoApiError, getNgoDeliveries } from '../../services/ngoService.js'

function TrackingPage() {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const result = await getNgoDeliveries()
      setDeliveries(result.deliveries || [])
      setError('')
    } catch (requestError) {
      setError(getNgoApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useRealtimeEvent('delivery:updated', () => { void load() })

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
        eyebrow="Collection coordination"
        title="Pickup and delivery"
        description="Review collection status, pickup locations, volunteer assignments, and delivery verification."
      />
      {error ? (
        <ProviderState type="error" title="Collection records unavailable" description={error} onRetry={retry} />
      ) : loading ? (
        <div className="provider-loading"><Loading label="Loading pickups and deliveries…" /></div>
      ) : deliveries.length ? (
        <div className="ngo-delivery-list">
          {deliveries.map((delivery) => (
            <NGODeliveryCard delivery={delivery} key={delivery._id} onUpdated={load} />
          ))}
        </div>
      ) : (
        <ProviderState
          title="No pickup or delivery records"
          description="Once a provider confirms one of your reservation requests, its pickup or delivery status will be shown here."
        />
      )}
    </div>
  )
}

export default TrackingPage

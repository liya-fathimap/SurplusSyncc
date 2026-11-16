import { useCallback, useEffect, useState } from 'react'
import { PackageSearch } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button.jsx'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import useRealtimeEvent from '../../hooks/useRealtimeEvent.js'
import VolunteerDeliveryCard from '../../components/volunteer/VolunteerDeliveryCard.jsx'
import VolunteerPageHeader from '../../components/volunteer/VolunteerPageHeader.jsx'
import { acceptVolunteerTask, getVolunteerApiError, getVolunteerAvailableTasks } from '../../services/volunteerService.js'

function AvailableTasksPage() {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const result = await getVolunteerAvailableTasks()
      setDeliveries(result.deliveries || [])
      setError('')
    } catch (requestError) {
      setError(getVolunteerApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [])

  useRealtimeEvent('delivery:available', () => { void load() })
  useRealtimeEvent('delivery:updated', () => { void load() })

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load, reloadKey])

  async function acceptTask(deliveryId) {
    setBusyId(deliveryId)
    setActionError('')
    try {
      await acceptVolunteerTask(deliveryId)
      navigate(`/volunteer/tasks/${deliveryId}`)
    } catch (requestError) {
      setActionError(getVolunteerApiError(requestError))
      setLoading(true)
      setReloadKey((key) => key + 1)
    } finally {
      setBusyId('')
    }
  }

  function refresh() {
    setLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="provider-page volunteer-page">
      <VolunteerPageHeader
        title="Available delivery tasks"
        description="Choose a confirmed volunteer delivery that fits your route and schedule."
        actions={<Button onClick={refresh} variant="secondary"><PackageSearch aria-hidden="true" /> Refresh</Button>}
      />
      {actionError && <div className="provider-alert" role="alert">{actionError}</div>}
      <Card className="provider-panel">
        {loading ? (
          <div className="provider-loading"><Loading label="Finding available delivery tasks…" /></div>
        ) : error ? (
          <ProviderState type="error" title="Available tasks are unavailable" description={error} onRetry={refresh} />
        ) : deliveries.length ? (
          <div className="volunteer-card-list">
            {deliveries.map((delivery) => (
              <VolunteerDeliveryCard
                actions={<Button disabled={busyId === delivery._id} onClick={() => acceptTask(delivery._id)} size="small">{busyId === delivery._id ? 'Accepting…' : 'Accept task'}</Button>}
                delivery={delivery}
                key={delivery._id}
              />
            ))}
          </div>
        ) : (
          <ProviderState title="No available tasks right now" description="New confirmed deliveries will appear here as soon as they are available." />
        )}
      </Card>
    </div>
  )
}

export default AvailableTasksPage

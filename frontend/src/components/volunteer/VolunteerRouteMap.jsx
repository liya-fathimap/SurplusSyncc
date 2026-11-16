import { useCallback, useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import ProviderState from '../provider/ProviderState.jsx'
import { getVolunteerApiError, getVolunteerTaskRoute } from '../../services/volunteerService.js'

const pickupIcon = L.divIcon({
  className: 'volunteer-route-marker volunteer-route-pickup',
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})
const destinationIcon = L.divIcon({
  className: 'volunteer-route-marker volunteer-route-destination',
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function getLeafletPosition(location) {
  const coordinates = location?.coordinates
  if (
    location?.type !== 'Point' ||
    !Array.isArray(coordinates) ||
    coordinates.length !== 2 ||
    !Number.isFinite(coordinates[0]) ||
    !Number.isFinite(coordinates[1]) ||
    Math.abs(coordinates[0]) > 180 ||
    Math.abs(coordinates[1]) > 90
  ) {
    return null
  }
  return [coordinates[1], coordinates[0]]
}

function FitRouteBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 2) map.fitBounds(points, { padding: [32, 32] })
  }, [map, points])
  return null
}

function VolunteerRouteMap({ deliveryId }) {
  const [routeData, setRouteData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRouteData(await getVolunteerTaskRoute(deliveryId))
      setError('')
    } catch (requestError) {
      setError(getVolunteerApiError(requestError))
      setRouteData(null)
    } finally {
      setLoading(false)
    }
  }, [deliveryId])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  const pickupPosition = useMemo(
    () => getLeafletPosition(routeData?.pickup?.location),
    [routeData],
  )
  const destinationPosition = useMemo(
    () => getLeafletPosition(routeData?.destination?.location),
    [routeData],
  )
  const routePositions = useMemo(
    () => (routeData?.route?.geometry?.coordinates || [])
      .filter((coordinate) =>
        Array.isArray(coordinate) &&
        coordinate.length === 2 &&
        coordinate.every(Number.isFinite),
      )
      .map(([longitude, latitude]) => [latitude, longitude]),
    [routeData],
  )
  const bounds = useMemo(
    () => [pickupPosition, destinationPosition].filter(Boolean),
    [pickupPosition, destinationPosition],
  )

  return (
    <section className="volunteer-route-section" aria-label="Delivery route">
      <div className="volunteer-route-heading">
        <div>
          <span className="provider-panel-kicker">Pickup to destination</span>
          <h3>Delivery route</h3>
        </div>
        {routeData?.route && (
          <p>
            {(routeData.route.distanceMeters / 1000).toFixed(1)} km ·{' '}
            {Math.round(routeData.route.durationSeconds / 60)} min estimated
          </p>
        )}
      </div>
      {loading ? (
        <p className="provider-data-note" role="status">Loading route…</p>
      ) : error ? (
        <ProviderState
          description={error}
          onRetry={() => { void load() }}
          title="Route is unavailable"
          type="error"
        />
      ) : pickupPosition && destinationPosition ? (
        <>
          <div className="ngo-map-canvas volunteer-route-map">
            <MapContainer center={pickupPosition} scrollWheelZoom zoom={12}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitRouteBounds points={bounds} />
              <Marker icon={pickupIcon} position={pickupPosition}>
                <Popup>Pickup: {routeData.pickup.address || 'Provider location'}</Popup>
              </Marker>
              <Marker icon={destinationIcon} position={destinationPosition}>
                <Popup>Destination: {routeData.destination.organizationName || 'Receiving organization'}</Popup>
              </Marker>
              {routePositions.length > 1 && (
                <Polyline positions={routePositions} pathOptions={{ color: '#173d32', weight: 5 }} />
              )}
            </MapContainer>
          </div>
          <p className="provider-data-note">
            Route and travel time are estimates from the public OSRM demo service. Pickup and destination coordinates are sent to that service to calculate the route.
          </p>
        </>
      ) : (
        <ProviderState title="Route is unavailable" description="This delivery does not have valid pickup and destination coordinates." />
      )}
    </section>
  )
}

export default VolunteerRouteMap

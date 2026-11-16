import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { MapPin } from 'lucide-react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const listingIcon = L.divIcon({
  className: 'admin-listing-marker',
  html: '<span></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

function getPosition(location) {
  const coordinates = location?.coordinates
  if (
    location?.type !== 'Point' ||
    !Array.isArray(coordinates) ||
    coordinates.length !== 2 ||
    !coordinates.every(Number.isFinite) ||
    Math.abs(coordinates[0]) > 180 ||
    Math.abs(coordinates[1]) > 90
  ) return null
  return [coordinates[1], coordinates[0]]
}

function FitOperationsBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [30, 30], maxZoom: 12 })
    else if (points.length === 1) map.setView(points[0], 11)
  }, [map, points])
  return null
}

function AdminOperationsMap({ listings, routes }) {
  const listingPoints = useMemo(() => listings
    .map((listing) => ({ listing, position: getPosition(listing.location) }))
    .filter((entry) => entry.position), [listings])

  const routeLines = useMemo(() => routes.map(({ delivery, routeData }) => {
    const coordinates = routeData?.route?.geometry?.coordinates
    if (!Array.isArray(coordinates)) return null
    const positions = coordinates
      .filter((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
      .map(([longitude, latitude]) => [latitude, longitude])
    return positions.length > 1 ? { delivery, positions } : null
  }).filter(Boolean), [routes])

  const points = useMemo(() => [
    ...listingPoints.map(({ position }) => position),
    ...routeLines.flatMap(({ positions }) => [positions[0], positions[positions.length - 1]]),
  ], [listingPoints, routeLines])

  if (!points.length) {
    return (
      <div className="admin-map-empty">
        <MapPin aria-hidden="true" />
        <strong>No mappable operations right now</strong>
        <p>Valid pickup coordinates from active food listings and deliveries appear here.</p>
      </div>
    )
  }

  return (
    <div className="admin-operations-map" aria-label="Map of active food listings and delivery routes">
      <MapContainer center={points[0]} scrollWheelZoom zoom={11}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitOperationsBounds points={points} />
        {listingPoints.map(({ listing, position }) => (
          <Marker icon={listingIcon} key={listing._id} position={position}>
            <Popup><strong>{listing.title}</strong><br />Pickup · {listing.foodCategory}</Popup>
          </Marker>
        ))}
        {routeLines.map(({ delivery, positions }, index) => (
          <Polyline
            key={delivery._id}
            positions={positions}
            pathOptions={{ color: ['#173d32', '#b26d4b', '#60784a', '#8b8b51'][index % 4], weight: 4, opacity: 0.82 }}
          />
        ))}
      </MapContainer>
    </div>
  )
}

export default AdminOperationsMap

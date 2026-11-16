import { useCallback, useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import {
  getAvailableListings,
  getNgoApiError,
  getNearbyListings,
  getNearbyProviders,
  getRecommendedListings,
} from '../../services/ngoService.js'
import { formatDate } from '../../utils/providerFormat.js'

const foodMarkerIcon = L.divIcon({
  className: 'ngo-food-marker',
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})
const providerMarkerIcon = L.divIcon({
  className: 'ngo-provider-marker',
  html: '<span></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})

function getCoordinates(location) {
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

function MapBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 1) {
      map.setView(points[0], 12)
    } else if (points.length > 1) {
      map.fitBounds(points, { padding: [32, 32], maxZoom: 13 })
    }
  }, [map, points])
  return null
}

function NearbyFoodMapPage() {
  const { user } = useAuth()
  const [listings, setListings] = useState([])
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mapNotice, setMapNotice] = useState('')

  const load = useCallback(async () => {
    try {
      if (user.isVerified && getCoordinates(user.location)) {
        const [nearbyResult, providerResult] = await Promise.all([
          getNearbyListings({
            longitude: user.location.coordinates[0],
            latitude: user.location.coordinates[1],
            radiusMeters: 100000,
            limit: 50,
          }),
          getNearbyProviders({
            longitude: user.location.coordinates[0],
            latitude: user.location.coordinates[1],
            radiusMeters: 100000,
            limit: 50,
          }),
        ])
        const recommendations = await getRecommendedListings({ limit: 100 })
        const recommendationsById = new Map(
          (recommendations.recommendations || []).map((item) => [String(item.listing?._id), item]),
        )
        setListings((nearbyResult.listings || []).map((listing) => ({
          ...listing,
          matchRecommendation: recommendationsById.get(String(listing._id)),
        })))
        setProviders(providerResult.providers || [])
        setMapNotice('')
      } else {
        const result = await getAvailableListings({ page: 1, limit: 100 })
        setListings(result.listings || [])
        setProviders([])
        setMapNotice(user.isVerified
          ? 'Add an organization map location to filter nearby listings. These recommendations are still ranked for your organization.'
          : 'NGO verification and a saved map location are required to filter nearby locations.')
      }
      setError('')
    } catch (requestError) {
      setError(getNgoApiError(requestError))
    } finally {
      setLoading(false)
    }
  }, [user.isVerified, user.location])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  const foodPoints = useMemo(() => listings
    .map((listing) => ({ listing, point: getCoordinates(listing.location) }))
    .filter(({ point }) => point), [listings])
  const providerPoints = useMemo(() => providers
    .map((provider) => ({ provider, point: getCoordinates(provider.location) }))
    .filter(({ point }) => point), [providers])
  const ngoPoint = useMemo(() => getCoordinates(user.location), [user.location])
  const boundsPoints = useMemo(() => [
    ...(ngoPoint ? [ngoPoint] : []),
    ...foodPoints.map(({ point }) => point),
    ...providerPoints.map(({ point }) => point),
  ], [ngoPoint, foodPoints, providerPoints])

  return (
    <div className="provider-page">
      <ProviderPageHeader
        eyebrow="Local food network"
        title="Nearby food map"
        description="Explore nearby food pickups and verified provider locations using MongoDB geographic filtering and OpenStreetMap."
      />
      {error ? (
        <ProviderState type="error" title="Nearby food could not be loaded" description={error} onRetry={() => {
          setLoading(true)
          void Promise.resolve().then(load)
        }} />
      ) : loading ? (
        <div className="provider-loading"><Loading label="Loading nearby food…" /></div>
      ) : foodPoints.length ? (
        <>
          {!ngoPoint && (
            <div className="provider-info-note" role="status">
              Your organization does not have a saved map location. Food pins still show exact provider pickup locations, but distance from your NGO cannot be calculated.
            </div>
          )}
          {mapNotice && ngoPoint && <div className="provider-info-note" role="status">{mapNotice}</div>}
          <Card className="provider-panel ngo-map-panel">
            <div className="provider-panel-heading">
              <div><span className="provider-panel-kicker">OpenStreetMap</span><h2>{foodPoints.length} mapped food listing{foodPoints.length === 1 ? '' : 's'}</h2></div>
              <span className="ngo-map-legend">
                <i aria-hidden="true" /> Food pickup
                <i className="ngo-map-provider-key" aria-hidden="true" /> Verified provider
              </span>
            </div>
            <div className="ngo-map-canvas" aria-label="Map of available food pickup locations">
              <MapContainer
                center={boundsPoints[0] || foodPoints[0].point}
                scrollWheelZoom
                zoom={12}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapBounds points={boundsPoints.length ? boundsPoints : foodPoints.map(({ point }) => point)} />
                {ngoPoint && (
                  <Marker position={ngoPoint}>
                    <Popup>Your organization</Popup>
                  </Marker>
                )}
                {foodPoints.map(({ listing, point }) => (
                  <Marker icon={foodMarkerIcon} key={listing._id} position={point}>
                    <Popup>
                      <div className="ngo-map-popup">
                        <strong>{listing.title}</strong>
                        <span>{listing.availableQuantity} {listing.unit} · {listing.foodCategory}</span>
                        {listing.matchRecommendation && (
                          <span>{listing.matchRecommendation.score}/100 match · {listing.matchRecommendation.distanceKm} km away</span>
                        )}
                        <span>Collect by {formatDate(listing.collectionDeadline)}</span>
                        <span>{listing.pickupAddress}</span>
                        <Link to={`/ngo/food/${listing._id}`}>View listing and request</Link>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                {providerPoints.map(({ provider, point }) => (
                  <Marker icon={providerMarkerIcon} key={provider._id} position={point}>
                    <Popup>
                      <div className="ngo-map-popup">
                        <strong>{provider.organizationName || 'Verified food provider'}</strong>
                        <span>Verified provider location</span>
                        <span>{(provider.distanceMeters / 1000).toFixed(1)} km away</span>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
            {foodPoints.length < listings.length && (
              <p className="provider-data-note">
                {listings.length - foodPoints.length} listing{listings.length - foodPoints.length === 1 ? ' does' : 's do'} not include valid map coordinates and {listings.length - foodPoints.length === 1 ? 'is' : 'are'} omitted.
              </p>
            )}
          </Card>
        </>
      ) : (
        <ProviderState
          title={listings.length ? 'No listings have map coordinates' : 'No available food to map'}
          description={listings.length
            ? 'The available listings do not include valid provider coordinates.'
            : 'Available provider pickup locations will appear here when food is listed.'}
        />
      )}
    </div>
  )
}

export default NearbyFoodMapPage

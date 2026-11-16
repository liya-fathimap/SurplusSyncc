import { useCallback, useEffect, useState } from 'react'
import { Map, Search, SlidersHorizontal } from 'lucide-react'
import Card from '../../components/common/Card.jsx'
import Loading from '../../components/common/Loading.jsx'
import Button from '../../components/common/Button.jsx'
import FoodFilters from '../../components/ngo/FoodFilters.jsx'
import FoodListingCard from '../../components/ngo/FoodListingCard.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import ProviderState from '../../components/provider/ProviderState.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import {
  getAvailableListings,
  getNgoApiError,
  getRecommendedListings,
} from '../../services/ngoService.js'

const emptyFilters = {
  category: '',
  minQuantity: '',
  maxQuantity: '',
  deadlineAfter: '',
  deadlineBefore: '',
}

function toQueryFilters(filters) {
  const params = {}
  if (filters.category.trim()) params.category = filters.category.trim()
  if (filters.minQuantity) params.minQuantity = Number(filters.minQuantity)
  if (filters.maxQuantity) params.maxQuantity = Number(filters.maxQuantity)
  if (filters.deadlineAfter) {
    params.deadlineAfter = new Date(`${filters.deadlineAfter}T00:00:00.000Z`).toISOString()
  }
  if (filters.deadlineBefore) {
    params.deadlineBefore = new Date(`${filters.deadlineBefore}T23:59:59.999Z`).toISOString()
  }
  return params
}

function DiscoverFoodPage() {
  const { user } = useAuth()
  const [filters, setFilters] = useState(emptyFilters)
  const [draftFilters, setDraftFilters] = useState(emptyFilters)
  const [listings, setListings] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [recommendationError, setRecommendationError] = useState('')
  const [mode, setMode] = useState('recommended')
  const [searchTerm, setSearchTerm] = useState('')
  const [savedIds, setSavedIds] = useState(() => (
    window.localStorage.getItem(`surplussync.savedListings.${user._id}`) || ''
  ).split(',').filter(Boolean))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    const query = toQueryFilters(filters)
    const [listingResult, recommendationResult] = await Promise.allSettled([
      getAvailableListings({ ...query, page: 1, limit: 100 }),
      user.isVerified ? getRecommendedListings({ ...query, limit: 100 }) : Promise.resolve({ recommendations: [] }),
    ])
    if (listingResult.status === 'fulfilled') {
      setListings(listingResult.value.listings || [])
      setError('')
    } else {
      setError(getNgoApiError(listingResult.reason))
    }
    if (recommendationResult.status === 'fulfilled') {
      setRecommendations(recommendationResult.value.recommendations || [])
      setRecommendationError('')
    } else {
      setRecommendations([])
      setRecommendationError(getNgoApiError(recommendationResult.reason))
    }
    setLoading(false)
  }, [filters, user.isVerified])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load, reloadKey])

  function applyFilters() {
    if (
      draftFilters.minQuantity &&
      draftFilters.maxQuantity &&
      Number(draftFilters.minQuantity) > Number(draftFilters.maxQuantity)
    ) {
      setError('Minimum quantity cannot be greater than maximum quantity.')
      return
    }
    if (
      draftFilters.deadlineAfter &&
      draftFilters.deadlineBefore &&
      draftFilters.deadlineAfter > draftFilters.deadlineBefore
    ) {
      setError('The earliest collection date cannot be after the latest collection date.')
      return
    }
    setLoading(true)
    setError('')
    setFilters({ ...draftFilters })
  }

  function retry() {
    setLoading(true)
    setError('')
    setReloadKey((key) => key + 1)
  }

  function toggleSavedListing(listingId) {
    const saved = savedIds.includes(listingId)
    const next = saved
      ? savedIds.filter((id) => id !== listingId)
      : [...savedIds, listingId]
    window.localStorage.setItem(`surplussync.savedListings.${user._id}`, next.join(','))
    setSavedIds(next)
  }

  const recommendationCards = recommendations.map((recommendation) => ({
    listing: recommendation.listing,
    recommendation,
  }))
  const sourceListings = mode === 'recommended'
    ? recommendationCards
    : listings
      .filter((listing) => mode !== 'saved' || savedIds.includes(String(listing._id)))
      .map((listing) => ({ listing, recommendation: null }))
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const visibleListings = sourceListings.filter(({ listing }) => (
    [listing.title, listing.description, listing.foodCategory, listing.pickupAddress, listing.provider?.organizationName]
      .some((value) => String(value || '').toLowerCase().includes(normalizedSearch))
  ))

  return (
    <div className="provider-page">
      <ProviderPageHeader
        eyebrow="Food discovery"
        title="Available food"
        description="Find surplus food from providers, compare collection details, and request a quantity that works for your organization."
        actions={<Button to="/ngo/map" variant="secondary"><Map aria-hidden="true" /> View nearby map</Button>}
      />

      <label className="ngo-search-bar">
        <Search aria-hidden="true" />
        <span className="sr-only">Search available food</span>
        <input
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by dish, category, provider, or pickup location"
          type="search"
          value={searchTerm}
        />
      </label>

      <Card className="provider-panel ngo-filter-panel">
        <div className="provider-panel-heading">
          <div><span className="provider-panel-kicker">Search available listings</span><h2><SlidersHorizontal aria-hidden="true" /> Filter food</h2></div>
        </div>
        <FoodFilters isLoading={loading} onApply={applyFilters} onChange={setDraftFilters} values={draftFilters} />
      </Card>

      {user.isVerified === false && (
        <div className="provider-info-note" role="status">
          Your NGO account is not verified yet. You can browse listings, but reservation requests require verification.
        </div>
      )}

      <div className="ngo-discovery-toolbar">
        <div className="ngo-discovery-tabs" role="tablist" aria-label="Food listing selection">
          <button
            aria-selected={mode === 'recommended'}
            className={mode === 'recommended' ? 'active' : ''}
            onClick={() => setMode('recommended')}
            role="tab"
            type="button"
          >
            Recommended for you <span>{recommendations.length}</span>
          </button>
          <button
            aria-selected={mode === 'all'}
            className={mode === 'all' ? 'active' : ''}
            onClick={() => setMode('all')}
            role="tab"
            type="button"
          >
            All available <span>{listings.length}</span>
          </button>
          <button
            aria-selected={mode === 'saved'}
            className={mode === 'saved' ? 'active' : ''}
            onClick={() => setMode('saved')}
            role="tab"
            type="button"
          >
            Saved <span>{savedIds.length}</span>
          </button>
        </div>
        <span className="ngo-listing-count">{visibleListings.length} listings</span>
      </div>

      {error ? (
        <ProviderState type="error" title="Available food could not be loaded" description={error} onRetry={retry} />
      ) : loading ? (
        <div className="provider-loading"><Loading label="Finding available food…" /></div>
      ) : mode === 'recommended' && recommendationError ? (
        <ProviderState
          type="error"
          title="Food recommendations unavailable"
          description={recommendationError}
          action={<Button onClick={() => setMode('all')} size="small" variant="secondary">Browse all listings</Button>}
          onRetry={retry}
        />
      ) : visibleListings.length ? (
        <div className="ngo-food-grid">
          {visibleListings.map(({ listing, recommendation }) => (
            <FoodListingCard
              isSaved={savedIds.includes(String(listing._id))}
              key={listing._id}
              listing={listing}
              onToggleSave={toggleSavedListing}
              recommendation={recommendation}
            />
          ))}
        </div>
      ) : (
        <ProviderState
          title={mode === 'recommended'
            ? 'No matching food recommendations'
            : mode === 'saved'
              ? 'No saved listings are available'
              : 'No listings match these filters'}
          description={mode === 'recommended'
            ? 'Try adjusting your accepted food categories, pickup capacity, or search filters. You can also browse all available listings.'
            : mode === 'saved'
              ? 'Save a listing to keep it close. Saved food remains available here while the provider listing is active.'
              : 'Change your category, quantity, deadline, or search terms and try again.'}
          action={mode !== 'all' && (
            <Button onClick={() => setMode('all')} size="small" variant="secondary">Browse all available</Button>
          )}
        />
      )}

      <p className="provider-data-note">
        Food matches use deterministic distance, quantity, category, deadline, and verification scoring. Browse results and recommendation scores come from the backend.
      </p>
    </div>
  )
}

export default DiscoverFoodPage

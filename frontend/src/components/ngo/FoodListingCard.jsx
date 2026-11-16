import { Clock3, Heart, MapPin, PackageCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import Card from '../common/Card.jsx'
import FoodPhoto from '../common/FoodPhoto.jsx'
import { formatDate } from '../../utils/providerFormat.js'

function FoodListingCard({ listing, recommendation, showDetailsLink = true, isSaved = false, onToggleSave }) {
  const listingId = listing._id || listing.id
  const reasons = recommendation?.reasons || []
  const scoreBreakdown = recommendation?.scoreBreakdown || {}
  const providerName = listing.provider?.organizationName || listing.provider?.name

  return (
    <Card className="ngo-food-card">
      <div className="ngo-food-photo-wrap">
        <FoodPhoto alt="" category={listing.foodCategory} className="ngo-food-photo" image={listing.image} />
        <span className="ngo-food-category">{listing.foodCategory}</span>
        {recommendation && (
          <span className="ngo-match-score" title="Deterministic matching score out of 100">
            {recommendation.score}<small>/100 match</small>
          </span>
        )}
      </div>
      <div className="ngo-food-card-content">
        {providerName && <span className="ngo-food-provider">{providerName}</span>}
        <h2>{listing.title}</h2>
        <p className="ngo-food-description">{listing.description}</p>
        <div className="ngo-food-facts">
        <span><PackageCheck aria-hidden="true" /><strong>{listing.availableQuantity} {listing.unit}</strong> available</span>
        <span><Clock3 aria-hidden="true" />Collect by {formatDate(listing.collectionDeadline)}</span>
        <span><MapPin aria-hidden="true" />{listing.pickupAddress}</span>
        </div>
        {recommendation && (
          <div className="ngo-match-reasons">
            {recommendation.recommendedQuantity != null && (
              <p className="ngo-recommended-quantity">
                Suggested amount: {recommendation.recommendedQuantity} {recommendation.unit}
              </p>
            )}
            <details>
              <summary>Why this food matches</summary>
              <ul>
                {Object.entries(scoreBreakdown).map(([factor, detail]) => (
                  <li key={factor}><strong>{factor.replaceAll('_', ' ')}</strong> · {detail.score}/100 · {detail.reason}</li>
                ))}
                {!Object.keys(scoreBreakdown).length && reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </details>
          </div>
        )}
        <div className="ngo-food-card-footer">
          {recommendation && (
            <span className="ngo-distance">{recommendation.distanceKm} km · {recommendation.estimatedTravelMinutes} min est.</span>
          )}
          <div className="ngo-food-card-actions">
            {onToggleSave && (
              <button
                aria-label={isSaved ? `Remove ${listing.title} from saved listings` : `Save ${listing.title}`}
                aria-pressed={isSaved}
                className={`ngo-save-button${isSaved ? ' is-saved' : ''}`}
                onClick={() => onToggleSave(listingId)}
                type="button"
              >
                <Heart aria-hidden="true" />
              </button>
            )}
            {showDetailsLink && (
              <Link
                className="button button-primary button-small"
                state={{ recommendation }}
                to={`/ngo/food/${listingId}`}
              >
                View food
              </Link>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default FoodListingCard

import { ArrowRight, MapPin, Package, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import Card from '../common/Card.jsx'
import { formatDate, formatLabel } from '../../utils/providerFormat.js'

function VolunteerDeliveryCard({ actions, delivery }) {
  const reservation = delivery.reservation
  const listing = reservation?.foodListing
  const ngo = reservation?.ngo
  const status = delivery.status || 'pending'

  return (
    <Card className="volunteer-delivery-card">
      <div className="volunteer-delivery-top">
        <span className="volunteer-delivery-icon"><Package aria-hidden="true" /></span>
        <div className="volunteer-delivery-title">
          <h2>{listing?.title || 'Food delivery'}</h2>
          <p>
            {reservation?.approvedQuantity ?? listing?.quantity ?? '—'} {listing?.unit || ''}
            {listing?.foodCategory ? ` · ${formatLabel(listing.foodCategory)}` : ''}
          </p>
        </div>
        <span className={`provider-status status-${status}`}>{formatLabel(status)}</span>
      </div>
      <div className="volunteer-delivery-meta">
        <span><MapPin aria-hidden="true" /><span><small>Pickup</small><strong>{listing?.pickupAddress || 'Address unavailable'}</strong></span></span>
        <span><UserRound aria-hidden="true" /><span><small>Organization</small><strong>{ngo?.organizationName || ngo?.name || 'Organization unavailable'}</strong></span></span>
        <span><Package aria-hidden="true" /><span><small>Collection deadline</small><strong>{formatDate(listing?.collectionDeadline)}</strong></span></span>
      </div>
      <div className="volunteer-delivery-footer">
        <Link className="provider-text-link" to={`/volunteer/tasks/${delivery._id}`}>
          Task details <ArrowRight aria-hidden="true" />
        </Link>
        {actions && <div className="volunteer-delivery-actions">{actions}</div>}
      </div>
    </Card>
  )
}

export default VolunteerDeliveryCard

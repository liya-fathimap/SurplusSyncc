import { useMemo } from 'react'
import { Building2, Mail, MapPin, Phone, ShieldCheck, UserRound } from 'lucide-react'
import Card from '../../components/common/Card.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import { useAuth } from '../../hooks/useAuth.js'

function getCoordinates(location) {
  const coordinates = location?.coordinates
  if (
    location?.type !== 'Point' ||
    !Array.isArray(coordinates) ||
    coordinates.length !== 2 ||
    !Number.isFinite(coordinates[0]) ||
    !Number.isFinite(coordinates[1])
  ) {
    return null
  }
  return `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`
}

function NGOProfilePage() {
  const { user } = useAuth()
  const coordinates = useMemo(() => getCoordinates(user.location), [user.location])

  return (
    <div className="provider-page">
      <ProviderPageHeader
        eyebrow="Organization profile"
        title="NGO profile"
        description="Review the account and verification details associated with your organization."
      />
      <Card className="provider-profile-card">
        <div className="provider-profile-banner">
          <span className="provider-profile-avatar"><Building2 aria-hidden="true" /></span>
          <div>
            <h2>{user.organizationName || user.name || 'Community organization'}</h2>
            <p>SurplusSync NGO account</p>
          </div>
          <span className={`provider-status ${user.isVerified ? 'status-confirmed' : 'status-pending'}`}>
            <ShieldCheck aria-hidden="true" /> {user.isVerified ? 'Verified organization' : 'Verification pending'}
          </span>
        </div>
        <div className="provider-profile-fields">
          <div><UserRound aria-hidden="true" /><span><small>Account contact</small><strong>{user.name || 'Not provided'}</strong></span></div>
          <div><Building2 aria-hidden="true" /><span><small>Organization</small><strong>{user.organizationName || 'Not provided'}</strong></span></div>
          <div><Mail aria-hidden="true" /><span><small>Email</small><strong>{user.email || 'Not provided'}</strong></span></div>
          <div><Phone aria-hidden="true" /><span><small>Phone</small><strong>{user.phone || 'Not provided'}</strong></span></div>
          <div><MapPin aria-hidden="true" /><span><small>Map location</small><strong>{coordinates || 'Not provided'}</strong></span></div>
        </div>
        {!user.isVerified && (
          <div className="provider-info-note">
            Reservation requests are available only to verified NGOs. Contact a platform administrator to submit or complete your organization verification.
          </div>
        )}
        {!coordinates && (
          <div className="provider-info-note">
            Add an organization location through the platform administrator to enable location-based food recommendations and map distance calculations.
          </div>
        )}
      </Card>
    </div>
  )
}

export default NGOProfilePage

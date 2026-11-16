import { BadgeCheck, Building2, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import Card from '../../components/common/Card.jsx'
import ProviderPageHeader from '../../components/provider/ProviderPageHeader.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { formatDate } from '../../utils/providerFormat.js'

function ProviderProfilePage() {
  const { user } = useAuth()
  const profileFields = [
    { label: 'Contact name', value: user.name, icon: UserRound },
    { label: 'Email address', value: user.email, icon: Mail },
    { label: 'Organization / business', value: user.organizationName || 'Not provided', icon: Building2 },
    { label: 'Phone number', value: user.phone || 'Not provided', icon: Phone },
    { label: 'Address', value: user.address || 'Not provided', icon: MapPin },
  ]

  return (
    <div className="provider-page">
      <ProviderPageHeader
        eyebrow="Account settings"
        title="Provider profile"
        description="Review the account details associated with your provider access."
      />
      <Card className="provider-panel provider-profile-card">
        <div className="provider-profile-banner">
          <span className="provider-profile-avatar">{user.name?.slice(0, 1).toUpperCase() || 'P'}</span>
          <div>
            <h2>{user.organizationName || user.name}</h2>
            <p>Food provider account</p>
          </div>
          <span className={`provider-status ${user.isActive === false ? 'status-cancelled' : 'status-available'}`}>
            <BadgeCheck aria-hidden="true" /> {user.isActive === false ? 'Inactive' : 'Active'}
          </span>
        </div>
        <div className="provider-profile-fields">
          {profileFields.map(({ icon: Icon, label, value }) => (
            <div className="provider-profile-field" key={label}>
              <span className="provider-profile-field-icon"><Icon aria-hidden="true" /></span>
              <span><small>{label}</small><strong>{value}</strong></span>
            </div>
          ))}
          <div className="provider-profile-field">
            <span className="provider-profile-field-icon"><BadgeCheck aria-hidden="true" /></span>
            <span><small>Account verification</small><strong>{user.isVerified ? 'Verified' : 'Not verified'}</strong></span>
          </div>
          <div className="provider-profile-field">
            <span className="provider-profile-field-icon"><UserRound aria-hidden="true" /></span>
            <span><small>Member since</small><strong>{formatDate(user.createdAt, { timeStyle: undefined })}</strong></span>
          </div>
        </div>
        <p className="provider-info-note">
          Profile information is read from your authenticated account. Profile editing is not currently exposed by the backend API.
        </p>
      </Card>
    </div>
  )
}

export default ProviderProfilePage

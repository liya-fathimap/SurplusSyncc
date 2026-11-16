import { BadgeCheck, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import Card from '../../components/common/Card.jsx'
import VolunteerPageHeader from '../../components/volunteer/VolunteerPageHeader.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { formatDate } from '../../utils/providerFormat.js'

function VolunteerProfilePage() {
  const { user } = useAuth()
  const fields = [
    { label: 'Full name', value: user?.name, icon: UserRound },
    { label: 'Email address', value: user?.email, icon: Mail },
    { label: 'Phone number', value: user?.phone || 'Not provided', icon: Phone },
    { label: 'Address', value: user?.address || 'Not provided', icon: MapPin },
  ]

  return (
    <div className="provider-page volunteer-page">
      <VolunteerPageHeader
        eyebrow="Account settings"
        title="Volunteer profile"
        description="Review the account details associated with your volunteer access."
      />
      <Card className="provider-panel volunteer-profile-card">
        <div className="volunteer-profile-banner">
          <span className="volunteer-profile-avatar">{user?.name?.slice(0, 1).toUpperCase() || 'V'}</span>
          <div><h2>{user?.name || 'Volunteer'}</h2><p>SurplusSync volunteer</p></div>
          <span className={`provider-status ${user?.isActive === false ? 'status-cancelled' : 'status-available'}`}>
            <BadgeCheck aria-hidden="true" /> {user?.isActive === false ? 'Inactive' : 'Active'}
          </span>
        </div>
        <div className="volunteer-profile-fields">
          {fields.map(({ icon: Icon, label, value }) => (
            <div className="volunteer-profile-field" key={label}>
              <span><Icon aria-hidden="true" /></span>
              <div><small>{label}</small><strong>{value || 'Not provided'}</strong></div>
            </div>
          ))}
          <div className="volunteer-profile-field">
            <span><BadgeCheck aria-hidden="true" /></span>
            <div><small>Member since</small><strong>{formatDate(user?.createdAt, { timeStyle: undefined })}</strong></div>
          </div>
        </div>
        <p className="provider-info-note">Profile information is read from your authenticated account. Profile editing is not currently exposed by the backend API.</p>
      </Card>
    </div>
  )
}

export default VolunteerProfilePage

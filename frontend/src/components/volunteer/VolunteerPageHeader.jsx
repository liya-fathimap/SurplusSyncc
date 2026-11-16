function VolunteerPageHeader({ actions, description, eyebrow = 'Volunteer workspace', title }) {
  return (
    <div className="provider-page-header volunteer-page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="provider-page-actions">{actions}</div>}
    </div>
  )
}

export default VolunteerPageHeader

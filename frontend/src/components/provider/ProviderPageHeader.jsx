function ProviderPageHeader({ actions, description, eyebrow, title }) {
  return (
    <div className="provider-page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="provider-page-actions">{actions}</div>}
    </div>
  )
}

export default ProviderPageHeader

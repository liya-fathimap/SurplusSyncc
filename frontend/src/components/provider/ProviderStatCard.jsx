import Card from '../common/Card.jsx'

function ProviderStatCard({ icon: Icon, label, loading, value, note }) {
  return (
    <Card className="provider-stat-card">
      <div className="provider-stat-top">
        <span className="provider-stat-icon"><Icon aria-hidden="true" /></span>
        {note && <span className="provider-stat-note">{note}</span>}
      </div>
      {loading ? (
        <span className="provider-stat-skeleton" aria-label="Loading statistic" />
      ) : (
        <strong className="provider-stat-value">{value}</strong>
      )}
      <span className="provider-stat-label">{label}</span>
    </Card>
  )
}

export default ProviderStatCard

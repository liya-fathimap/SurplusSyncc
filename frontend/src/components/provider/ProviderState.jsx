import { AlertCircle, Inbox } from 'lucide-react'
import Button from '../common/Button.jsx'

function ProviderState({ action, description, onRetry, title, type = 'empty' }) {
  const isError = type === 'error'
  const Icon = isError ? AlertCircle : Inbox

  return (
    <div className={`provider-state${isError ? ' is-error' : ''}`} role={isError ? 'alert' : 'status'}>
      <span className="provider-state-icon"><Icon aria-hidden="true" /></span>
      <h3>{title || (isError ? 'We could not load this information' : 'Nothing to show yet')}</h3>
      {description && <p>{description}</p>}
      {onRetry && <Button onClick={onRetry} size="small" variant="secondary">Try again</Button>}
      {action}
    </div>
  )
}

export default ProviderState

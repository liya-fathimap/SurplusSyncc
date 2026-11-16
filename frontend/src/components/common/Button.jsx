import { Link } from 'react-router-dom'

function Button({
  as: Element = 'button',
  children,
  className = '',
  disabled = false,
  href,
  size = 'medium',
  to,
  type = 'button',
  variant = 'primary',
  ...props
}) {
  const classes = `button button-${variant} button-${size} ${className}`.trim()

  if (to) {
    return (
      <Link className={classes} to={to} {...props}>
        {children}
      </Link>
    )
  }

  if (href) {
    return (
      <a className={classes} href={href} {...props}>
        {children}
      </a>
    )
  }

  return (
    <Element
      className={classes}
      disabled={disabled}
      type={Element === 'button' ? type : undefined}
      {...props}
    >
      {children}
    </Element>
  )
}

export default Button

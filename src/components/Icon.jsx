export function Icon({ name, className = '' }) {
  return <span className={`ui-icon ${className}`} style={{ '--icon-url': `url("/icons/${name}.svg")` }} aria-hidden="true" />
}

import './Logo.css';

export function Logo({
  variant = 'horizontal',
  tagline = null,
  size = 'default',
  className = '',
  onClick = null,
}) {
  if (variant === 'stacked') {
    return (
      <div className={`logo-lockup-stacked ${className}`} onClick={onClick}>
        <img
          src="/assets/logo.png"
          alt="Pixabel Logo"
          className={`${size === 'xl' ? 'logo-full-img-xl' : size === 'large' ? 'logo-full-img-large' : 'logo-full-img'} logo-shimmer-anim`}
        />
        {tagline && <div className="auth-tagline">{tagline}</div>}
      </div>
    );
  }

  return (
    <div
      className={`logo-lockup-horizontal ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(e);
        }
      }}
    >
      <div className="logo-title">
        Pi<span className="logo-accent">x</span>abel
      </div>
    </div>
  );
}

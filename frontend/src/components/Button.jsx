import './Button.css';

export function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  onClick,
  title,
  ariaLabel,
  ...props
}) {
  let variantClass = 'btn-primary';
  if (variant === 'secondary') variantClass = 'btn-secondary';
  else if (variant === 'danger') variantClass = 'btn-secondary danger';
  else if (variant === 'icon') variantClass = 'icon-btn';
  else if (variant === 'login') variantClass = 'login-btn';
  else if (variant === 'auth') variantClass = 'auth-btn-primary';

  return (
    <button
      type={type}
      className={`${variantClass} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      {...props}
    >
      {loading && <span className="btn-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

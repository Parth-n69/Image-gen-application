import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import './NotFound.css';

export function NotFound() {
  return (
    <div className="not-found-page">
      <Logo variant="stacked" size="large" />
      <div className="not-found-code">404</div>
      <h1 className="not-found-title">Page Not Found</h1>
      <p className="not-found-desc">
        The canvas you are looking for does not exist or has been moved to another gallery.
      </p>
      <Link to="/" className="btn-primary" style={{ textDecoration: 'none' }}>
        Return to Studio
      </Link>
    </div>
  );
}

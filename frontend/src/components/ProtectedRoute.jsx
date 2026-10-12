import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children, allowGuest = false }) {
  const { user, isGuest, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <img
            src="/assets/logo.png"
            alt="Pixabel"
            style={{ width: '56px', height: '56px', marginBottom: '16px', opacity: 0.8 }}
          />
          <div
            style={{
              color: 'var(--gold)',
              fontFamily: 'var(--font-serif)',
              fontSize: '1.25rem',
              letterSpacing: '0.05em',
            }}
          >
            PIXABEL
          </div>
        </div>
      </div>
    );
  }

  if (user || (allowGuest && isGuest)) {
    return children;
  }

  return <Navigate to="/login" state={{ from: location }} replace />;
}

import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

export function Privacy() {
  return (
    <div style={{ maxWidth: '720px', margin: '40px auto', padding: '0 24px', color: 'var(--text)' }}>
      <Logo variant="horizontal" style={{ marginBottom: '24px' }} />
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: '24px', color: 'var(--gold)' }}>
        Privacy Policy
      </h1>
      <p style={{ lineHeight: 1.6, color: 'var(--text-muted)', marginBottom: '32px' }}>
        We value your privacy. Your data and generated images are securely stored and never shared with unauthorized third parties.
      </p>
      <Link to="/login" className="btn-secondary" style={{ textDecoration: 'none' }}>
        Back to Login
      </Link>
    </div>
  );
}

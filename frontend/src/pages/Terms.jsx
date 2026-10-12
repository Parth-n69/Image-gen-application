import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

export function Terms() {
  return (
    <div style={{ maxWidth: '720px', margin: '40px auto', padding: '0 24px', color: 'var(--text)' }}>
      <Logo variant="horizontal" style={{ marginBottom: '24px' }} />
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: '24px', color: 'var(--gold)' }}>
        Terms of Service
      </h1>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--gold)' }}>
          1. Data Privacy and Safety
        </h2>
        <p style={{ lineHeight: 1.6, color: 'var(--text-muted)' }}>
          We value your privacy and security. <strong style={{ color: 'var(--text)' }}>Your user data is completely safe with us.</strong> We employ industry-standard encryption and security measures to protect your personal information and generated images. We do not sell your data to third parties.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--gold)' }}>
          2. Freedom of Use
        </h2>
        <p style={{ lineHeight: 1.6, color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text)' }}>Use the app however you want!</strong> Whether you are creating art for personal projects, commercial use, or just for fun, you have the creative freedom to explore and generate without restrictive limitations, provided it complies with our acceptable use policy.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--gold)' }}>
          3. Acceptable Use Policy
        </h2>
        <p style={{ lineHeight: 1.6, color: 'var(--text-muted)' }}>
          While we encourage creative freedom, users must not use our service to generate content that is illegal, hateful, discriminatory, or intended to harass others. We reserve the right to suspend accounts that violate these guidelines.
        </p>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--gold)' }}>
          4. Intellectual Property
        </h2>
        <p style={{ lineHeight: 1.6, color: 'var(--text-muted)' }}>
          You retain the rights to the images you generate using Pixabel. We do not claim ownership over your creations.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--gold)' }}>
          5. Changes to Terms
        </h2>
        <p style={{ lineHeight: 1.6, color: 'var(--text-muted)' }}>
          We may update these terms occasionally to reflect changes in our service. We will notify users of any significant changes.
        </p>
      </section>

      <Link to="/login" className="btn-secondary" style={{ textDecoration: 'none' }}>
        Back to Login
      </Link>
    </div>
  );
}

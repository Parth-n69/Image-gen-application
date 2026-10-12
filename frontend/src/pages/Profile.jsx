import { Header } from '../components/Header';

export function Profile() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      <Header showTabs={false} backToApp={true} />
      <main style={{ padding: '40px 24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', color: 'var(--gold)' }}>Profile</h1>
      </main>
    </div>
  );
}

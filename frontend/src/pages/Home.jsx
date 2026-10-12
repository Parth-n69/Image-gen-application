import { useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';

export function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'generate';

  const handleTabChange = (tab) => {
    setSearchParams({ tab });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <Header activeTab={currentTab} onTabChange={handleTabChange} galleryCount={0} />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Pixabel Studio — Active Tab: {currentTab}</p>
      </main>
    </div>
  );
}

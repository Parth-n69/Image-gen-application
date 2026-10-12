import './Tabs.css';

export function Tabs({ activeTab = 'generate', onTabChange, galleryCount = 0 }) {
  const tabs = [
    { id: 'generate', label: 'Generate' },
    { id: 'edit', label: 'Edit' },
    {
      id: 'gallery',
      label: 'Gallery',
      count: galleryCount > 0 ? `(${galleryCount})` : '',
    },
  ];

  return (
    <nav className="tab-bar" id="tab-bar" aria-label="Main Navigation">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            className={`tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onTabChange && onTabChange(tab.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            {tab.label}
            {tab.count && <span className="tab-count">{tab.count}</span>}
          </button>
        );
      })}
    </nav>
  );
}

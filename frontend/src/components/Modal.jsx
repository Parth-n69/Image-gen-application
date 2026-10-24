import { useEffect } from 'react';
import './Modal.css';

export function Modal({ isOpen, onClose, children, className = '' }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className={className}>{children}</div>
    </div>
  );
}

/* ── Static fallback model options (used when /models hasn't loaded yet) ── */
export const MODEL_OPTIONS = [
  {
    key: 'cf-flux-schnell',
    name: 'FLUX.1 Schnell',
    desc: 'Lightning-fast generation via Cloudflare Workers AI',
    badge: 'Free daily',
    badgeClass: 'free',
    icon: '⚡',
    provider: 'cloudflare',
  },
  {
    key: 'cf-sdxl-lightning',
    name: 'SDXL Lightning',
    desc: 'High-resolution generation with negative prompt & custom sizes',
    badge: 'Free daily',
    badgeClass: 'free',
    icon: '◈',
    provider: 'cloudflare',
  },
  {
    key: 'flux-schnell',
    name: 'FLUX Schnell',
    desc: 'Lightning-fast generation with remarkable clarity',
    badge: 'Limited credits',
    badgeClass: 'limited',
    icon: '⚡',
    provider: 'huggingface',
  },
  {
    key: 'flux-dev',
    name: 'FLUX Dev',
    desc: 'Exceptional detail & prompt adherence for discerning creators',
    badge: 'Limited credits',
    badgeClass: 'limited',
    icon: '✦',
    provider: 'huggingface',
  },
  {
    key: 'sd3.5',
    name: 'Stable Diffusion 3.5',
    desc: "Stability AI's flagship for complex composition",
    badge: 'Limited credits',
    badgeClass: 'limited',
    icon: '◈',
    provider: 'huggingface',
  },
  {
    key: 'sdxl',
    name: 'Stable Diffusion XL',
    desc: 'Classic high-resolution model with rich aesthetics',
    badge: 'Limited credits',
    badgeClass: 'limited',
    icon: '❖',
    provider: 'huggingface',
  },
];

export const MODEL_LABELS = {
  'cf-flux-schnell': 'FLUX.1 Schnell (CF)',
  'cf-sdxl-lightning': 'SDXL Lightning (CF)',
  'flux-schnell': 'FLUX Schnell',
  'flux-dev': 'FLUX Dev',
  'sd3.5': 'Stable Diffusion 3.5',
  'sdxl': 'Stable Diffusion XL',
};

/**
 * Build a label lookup from a dynamic model list.
 * Falls back to MODEL_LABELS for keys not in the list.
 */
export function buildModelLabels(modelList) {
  const labels = { ...MODEL_LABELS };
  if (modelList && Array.isArray(modelList)) {
    modelList.forEach((m) => {
      labels[m.key] = m.name;
    });
  }
  return labels;
}

export function ModelPickerModal({ isOpen, onClose, selectedModel, onSelectModel, dynamicModels }) {
  if (!isOpen) return null;

  const models = dynamicModels && dynamicModels.length > 0 ? dynamicModels : MODEL_OPTIONS;

  // Group by provider
  const cfModels = models.filter((m) => m.provider === 'cloudflare');
  const hfModels = models.filter((m) => m.provider === 'huggingface');

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="model-modal">
      <div className="model-modal-header">
        <h3>Choose Model</h3>
        <button
          type="button"
          className="model-modal-close"
          onClick={onClose}
          aria-label="Close model picker"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="model-modal-grid">
        {cfModels.length > 0 && (
          <>
            <div className="model-section-label">Cloudflare Workers AI</div>
            {cfModels.map((model) => {
              const key = model.key;
              const isActive = selectedModel === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`model-card ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onSelectModel(key);
                    onClose();
                  }}
                >
                  <div className="model-card-icon" aria-hidden="true">
                    {model.icon}
                  </div>
                  <div className="model-card-info">
                    <div className="model-card-name">{model.name}</div>
                    <div className="model-card-desc">{model.desc}</div>
                  </div>
                  <span className={`model-card-badge ${model.badgeClass || model.badge_class || ''}`}>
                    {model.badge}
                  </span>
                </button>
              );
            })}
          </>
        )}

        {hfModels.length > 0 && (
          <>
            <div className="model-section-label" style={cfModels.length > 0 ? { marginTop: '8px' } : {}}>
              Hugging Face
            </div>
            {hfModels.map((model) => {
              const key = model.key;
              const isActive = selectedModel === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`model-card ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onSelectModel(key);
                    onClose();
                  }}
                >
                  <div className="model-card-icon" aria-hidden="true">
                    {model.icon}
                  </div>
                  <div className="model-card-info">
                    <div className="model-card-name">{model.name}</div>
                    <div className="model-card-desc">{model.desc}</div>
                  </div>
                  <span className={`model-card-badge ${model.badgeClass || model.badge_class || ''}`}>
                    {model.badge}
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </Modal>
  );
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  isDanger = true,
  children,
}) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="confirm-dialog">
      <div className="confirm-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          width="24"
          height="24"
          aria-hidden="true"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {children && <div className="confirm-extra">{children}</div>}
      <div className="confirm-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>
          {cancelText}
        </button>
        <button
          type="button"
          className={`btn-primary ${isDanger ? 'danger' : ''}`}
          style={isDanger ? { background: 'var(--danger)', color: '#fff' } : {}}
          onClick={onConfirm}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

export function LightboxModal({
  isOpen,
  onClose,
  record,
  onToggleFavorite,
  onReuseSettings,
  onEditImage,
  onDelete,
  onDownload,
}) {
  if (!isOpen || !record) return null;

  const modelLabel = MODEL_LABELS[record.model] || record.model || 'Unknown';
  const styleLabel = record.style && record.style !== 'none' ? record.style : 'None';
  const sizeLabel = `${record.width || 1024} × ${record.height || 1024}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="lightbox-modal">
      <button
        type="button"
        className="lightbox-close"
        onClick={onClose}
        aria-label="Close lightbox"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className="lightbox-content">
        <div className="lightbox-image-wrap">
          <img src={record.image} alt={record.prompt || 'Generated preview'} />
        </div>

        <div className="lightbox-details">
          <div className="lightbox-detail-section">
            <div className="lightbox-detail-label">Prompt</div>
            <div className="lightbox-detail-value">{record.prompt}</div>
          </div>

          {record.type === 'edit' && record.editPrompt && (
            <div className="lightbox-detail-section">
              <div className="lightbox-detail-label">Edit Prompt</div>
              <div className="lightbox-detail-value">{record.editPrompt}</div>
            </div>
          )}

          {record.negativePrompt && (
            <div className="lightbox-detail-section">
              <div className="lightbox-detail-label">Negative Prompt</div>
              <div className="lightbox-detail-value">{record.negativePrompt}</div>
            </div>
          )}

          <div className="lightbox-detail-row">
            <div className="lightbox-detail-section">
              <div className="lightbox-detail-label">Model</div>
              <div className="lightbox-detail-value">{modelLabel}</div>
            </div>
            <div className="lightbox-detail-section">
              <div className="lightbox-detail-label">Style</div>
              <div className="lightbox-detail-value">{styleLabel}</div>
            </div>
            <div className="lightbox-detail-section">
              <div className="lightbox-detail-label">Size</div>
              <div className="lightbox-detail-value">{sizeLabel}</div>
            </div>
          </div>

          <div className="lightbox-actions">
            {onReuseSettings && (
              <button
                type="button"
                className="lightbox-action-btn primary"
                onClick={() => {
                  onReuseSettings(record);
                  onClose();
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <span>Reuse Settings</span>
              </button>
            )}

            {onDownload && (
              <button
                type="button"
                className="lightbox-action-btn"
                onClick={() => onDownload(record)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                <span>Download</span>
              </button>
            )}

            {onToggleFavorite && (
              <button
                type="button"
                className={`lightbox-action-btn ${record.favorite ? 'active' : ''}`}
                onClick={() => onToggleFavorite(record.id)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill={record.favorite ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2"
                  width="14"
                  height="14"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>{record.favorite ? 'Favorited' : 'Favorite'}</span>
              </button>
            )}

            {onEditImage && (
              <button
                type="button"
                className="lightbox-action-btn"
                onClick={() => {
                  onEditImage(record);
                  onClose();
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
                </svg>
                <span>Edit this image</span>
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                className="lightbox-action-btn danger"
                onClick={() => onDelete(record)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

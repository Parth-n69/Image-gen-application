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

export const MODEL_OPTIONS = [
  {
    key: 'flux-schnell',
    name: 'FLUX Schnell',
    desc: 'Lightning-fast generation with remarkable clarity',
    badge: 'Fast',
    badgeClass: 'fast',
    icon: '⚡',
  },
  {
    key: 'flux-dev',
    name: 'FLUX Dev',
    desc: 'Exceptional detail & prompt adherence for discerning creators',
    badge: 'Quality',
    badgeClass: 'quality',
    icon: '✦',
  },
  {
    key: 'sd3.5',
    name: 'Stable Diffusion 3.5',
    desc: "Stability AI's flagship for complex composition",
    badge: 'Quality',
    badgeClass: 'quality',
    icon: '◈',
  },
  {
    key: 'sdxl',
    name: 'Stable Diffusion XL',
    desc: 'Classic high-resolution model with rich aesthetics',
    badge: 'Quality',
    badgeClass: 'quality',
    icon: '❖',
  },
];

export const MODEL_LABELS = {
  'flux-schnell': 'FLUX Schnell',
  'flux-dev': 'FLUX Dev',
  'sd3.5': 'Stable Diffusion 3.5',
  'sdxl': 'Stable Diffusion XL',
};

export function ModelPickerModal({ isOpen, onClose, selectedModel, onSelectModel }) {
  if (!isOpen) return null;

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
        {MODEL_OPTIONS.map((model) => {
          const isActive = selectedModel === model.key;
          return (
            <button
              key={model.key}
              type="button"
              className={`model-card ${isActive ? 'active' : ''}`}
              onClick={() => {
                onSelectModel(model.key);
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
              <span className={`model-card-badge ${model.badgeClass}`}>{model.badge}</span>
            </button>
          );
        })}
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

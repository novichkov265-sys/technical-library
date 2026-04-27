import './ConfirmModal.css';
export default function ConfirmModal({ 
  isOpen = true,
  title = 'Подтверждение', 
  message, 
  onConfirm, 
  onCancel,
  onClose,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  type,
  confirmStyle
}) {
  if (!isOpen) return null;
  const handleCancel = onCancel || onClose;
  const modalType = type || confirmStyle || 'danger';
  return (
    <div className="confirm-modal-overlay" onClick={handleCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <div className={`confirm-modal-icon ${modalType === 'primary' ? 'warning' : modalType}`}>
            {modalType === 'danger' ? (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <h3 className="confirm-modal-title">{title}</h3>
        </div>
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-actions">
          <button onClick={handleCancel} className="confirm-modal-btn confirm-modal-btn-cancel">
            {cancelText}
          </button>
          <button 
            onClick={onConfirm} 
            className={`confirm-modal-btn confirm-modal-btn-confirm ${modalType === 'primary' ? 'primary' : ''}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
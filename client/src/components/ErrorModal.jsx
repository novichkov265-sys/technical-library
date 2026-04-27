import './ErrorModal.css';
export default function ErrorModal({ message, onClose }) {
  return (
    <div className="error-modal-overlay" onClick={onClose}>
      <div className="error-modal" onClick={(e) => e.stopPropagation()}>
        <div className="error-modal-header">
          <div className="error-modal-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="error-modal-title">Ошибка</h3>
        </div>
        <p className="error-modal-message">{message}</p>
        <div className="error-modal-actions">
          <button onClick={onClose} className="error-modal-btn">
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
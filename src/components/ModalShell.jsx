export function ModalShell({ title, children, actions, onClose, width }) {
  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div
        className="modal"
        style={width ? { width } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modalHeader">
          <h3>{title}</h3>
          <button className="btn btnLight" onClick={onClose}>Close</button>
        </div>
        <div className="modalBody">{children}</div>
        {actions ? <div className="modalActions">{actions}</div> : null}
      </div>
    </div>
  )
}

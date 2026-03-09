import { useEffect } from 'react';
import { Button } from './Button';

export function Modal({ open, onClose, title, children, actions }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} style={{ animation: 'fadeIn 0.15s ease-out' }} />
      <div className="relative bg-surface rounded-xl shadow-xl border border-gray-100 max-w-md w-full p-6 z-10" style={{ animation: 'scaleIn 0.2s ease-out' }}>
        {title && <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>}
        <div className="text-gray-600 text-sm">{children}</div>
        {actions && <div className="flex justify-end gap-2 mt-5">{actions}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmText = 'Confirm', danger = false }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmText}</Button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}

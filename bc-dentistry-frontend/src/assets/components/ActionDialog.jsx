import { useEffect, useRef } from 'react';

const ActionDialog = ({ title, description, confirmLabel = 'Confirm', danger = false, busy = false, error = '', children, onConfirm, onClose }) => {
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    closeButton.current?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape' && !busy) onCloseRef.current?.();
      if (event.key !== 'Tab' || !dialog.current) return;
      const controls = [...dialog.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')];
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [busy]);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="action-dialog-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="action-dialog-title" className="text-2xl font-bold text-gray-950">{title}</h2>{description && <p className="mt-2 text-sm text-gray-600">{description}</p>}</div>
        <button ref={closeButton} type="button" onClick={onClose} disabled={busy} className="rounded-md px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Close</button>
      </div>
      {children && <div className="mt-5">{children}</div>}
      {error && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-md border px-4 py-2 font-semibold">Cancel</button>
        <button type="button" onClick={onConfirm} disabled={busy} className={`rounded-md px-4 py-2 font-semibold text-white ${danger ? 'bg-red-700 hover:bg-red-800' : 'bg-blue-900 hover:bg-blue-950'}`}>{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </div>
  </div>;
};

export default ActionDialog;

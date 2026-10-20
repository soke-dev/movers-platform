import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon.jsx';

/** Dialog that becomes a bottom sheet on phones. Closes on Escape and backdrop click. */
export function Modal({ title, onClose, wide, children, labelledBy = 'mTitle' }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current?.querySelector('input:not([type=radio]):not([type=checkbox]),select,textarea,button:not(.x)');
    (el || ref.current)?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (prev && document.contains(prev)) prev.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return createPortal(
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={ref} tabIndex={-1}>
        {onClose && (
          <button className="x" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
        )}
        {title && <h3 id={labelledBy}>{title}</h3>}
        {children}
      </div>
    </div>,
    document.body
  );
}

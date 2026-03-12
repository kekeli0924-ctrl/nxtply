import { useEffect } from 'react';

const VARIANTS = {
  success: 'bg-accent text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-blue-600 text-white',
};

export function Toast({ message, show, onHide, variant = 'success' }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onHide, variant === 'error' ? 4000 : 2500);
      return () => clearTimeout(timer);
    }
  }, [show, onHide, variant]);

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50" role="alert" aria-live="assertive" style={{ animation: 'fadeSlideUp 0.2s ease-out' }}>
      <div className={`${VARIANTS[variant] || VARIANTS.success} px-5 py-3 rounded-lg shadow-lg text-sm font-medium`}>
        {message}
      </div>
    </div>
  );
}

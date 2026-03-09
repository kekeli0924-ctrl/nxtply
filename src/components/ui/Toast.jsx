import { useEffect } from 'react';

export function Toast({ message, show, onHide }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onHide, 2500);
      return () => clearTimeout(timer);
    }
  }, [show, onHide]);

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50" style={{ animation: 'fadeSlideUp 0.2s ease-out' }}>
      <div className="bg-accent text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium">
        {message}
      </div>
    </div>
  );
}

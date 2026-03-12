export function Button({ children, onClick, variant = 'primary', type = 'button', className = '', disabled, ...rest }) {
  const base = 'px-4 py-2 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-accent text-white hover:bg-accent-light font-semibold',
    secondary: 'bg-gray-200 text-gray-700 hover:bg-gray-300',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
    ghost: 'text-gray-500 hover:text-gray-700 hover:bg-surface-hover',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

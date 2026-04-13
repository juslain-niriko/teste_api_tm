import React from 'react';
import tokens from './tokens';

const Btn = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md', 
  disabled = false,
  style = {}
}) => {
  const variants = {
    primary: {
      background: tokens.primary,
      color: 'white',
      border: 'none',
    },
    secondary: {
      background: tokens.surfaceAlt,
      color: tokens.text,
      border: `1px solid ${tokens.border}`,
    },
    danger: {
      background: tokens.danger,
      color: 'white',
      border: 'none',
    },
    success: {
      background: tokens.success,
      color: 'white',
      border: 'none',
    },
  };

  const sizes = {
    sm: { padding: '6px 12px', fontSize: '12px' },
    md: { padding: '8px 16px', fontSize: '14px' },
    lg: { padding: '12px 24px', fontSize: '16px' },
  };

  const variantStyle = variants[variant] || variants.primary;
  const sizeStyle = sizes[size] || sizes.md;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        borderRadius: tokens.radius,
        fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s ease',
        ...variantStyle,
        ...sizeStyle,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.filter = 'brightness(0.95)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = 'brightness(1)';
      }}
    >
      {children}
    </button>
  );
};

export default Btn;

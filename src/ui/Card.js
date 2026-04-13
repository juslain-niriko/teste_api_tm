import React from 'react';
import tokens from './tokens';

const Card = ({ children, style = {} }) => {
  return (
    <div
      style={{
        background: tokens.surface,
        borderRadius: tokens.radius,
        border: `1px solid ${tokens.border}`,
        padding: '24px',
        boxShadow: tokens.shadowSm,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Card;

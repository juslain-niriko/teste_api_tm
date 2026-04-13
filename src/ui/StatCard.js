import React from 'react';
import tokens from './tokens';

const StatCard = ({ title, count, color }) => (
    <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        background: tokens.surfaceAlt,
        borderRadius: tokens.radius,
        border: `1px solid ${tokens.border}`,
        transition: 'all 0.3s ease'
    }}
    onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = tokens.shadowMd;
    }}
    onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
    }}>
        <h4 style={{ 
            color: color, 
            margin: '0 0 8px 0',
            fontSize: '14px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
        }}>{title}</h4>
        <div style={{ 
            fontSize: '36px', 
            fontWeight: 'bold', 
            color,
            lineHeight: '1',
            marginBottom: '8px'
        }}>
            {count.toLocaleString()}
        </div>
        <div style={{
            fontSize: '11px',
            color: tokens.textMuted,
            fontWeight: '500'
        }}>
            {count === 0 ? 'Aucun' : count === 1 ? '1 élément' : `${count} éléments`}
        </div>
    </div>
);

export default StatCard;

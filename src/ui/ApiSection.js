import React from 'react';
import Card from './Card';
import tokens from './tokens';

const ApiSection = ({ title, icon, count, data, renderItem, maxHeight = '200px' }) => (
    <Card style={{ 
        marginBottom: '24px',
        background: tokens.surface,
        border: `1px solid ${tokens.border}` 
    }}>
        <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
        }}>
            <h3 style={{ 
                color: tokens.text,
                fontSize: '18px',
                fontWeight: '600',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                <span style={{ color: tokens.primary }}>
                    {icon}
                </span>
                {title}
            </h3>
            <span style={{
                background: tokens.primary,
                color: 'white',
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: '600'
            }}>
                {count}
            </span>
        </div>
        <div style={{ 
            display: 'grid', 
            gap: '8px',
            maxHeight,
            overflowY: 'auto'
        }}>
            {data.map((item, index) => (
                <div key={item.id || index}>
                    {renderItem(item)}
                </div>
            ))}
        </div>
    </Card>
);

export default ApiSection;

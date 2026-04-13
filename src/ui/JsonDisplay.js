import React from 'react';
import Card from './Card';
import tokens from './tokens';

const JsonDisplay = ({ title, icon, data, color = 'primary', maxHeight = '400px' }) => {
    if (!data) return null;

    const colorMap = {
        primary: tokens.primary,
        success: tokens.success,
        warning: tokens.warning,
        danger: tokens.danger,
        info: tokens.info
    };

    const selectedColor = colorMap[color] || tokens.primary;

    return (
        <Card style={{ 
            background: tokens.surface,
            border: `1px solid ${tokens.border}`,
            marginTop: '24px'
        }}>
            <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
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
                    <span style={{ color: selectedColor }}>
                        {icon}
                    </span>
                    {title} (JSON brut)
                </h3>
                <span style={{
                    background: selectedColor,
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '600'
                }}>
                    RAW JSON
                </span>
            </div>
            
            <div style={{
                background: '#1e1e1e',
                color: '#d4d4d4',
                padding: '20px',
                borderRadius: tokens.radius,
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                fontSize: '12px',
                lineHeight: '1.5',
                overflow: 'auto',
                maxHeight,
                border: `1px solid ${tokens.border}`,
                whiteSpace: 'pre-wrap'
            }}>
                {JSON.stringify(data, null, 2)}
            </div>
        </Card>
    );
};

export default JsonDisplay;

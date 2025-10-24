import React from 'react';

const AccessibilityIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="5" r="1" />
        <path d="M18 20v-5.33A2 2 0 0 0 16.33 13H7.67a2 2 0 0 0-1.67 1.67V20" />
        <path d="M6 20v-3" />
        <path d="M12 20v-9" />
        <path d="M18 20v-3" />
    </svg>
);

export default AccessibilityIcon;
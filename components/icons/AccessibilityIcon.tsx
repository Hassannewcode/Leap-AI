import React from 'react';

const AccessibilityIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="5" r="1" />
        <path d="M12 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M12 11.5V14" />
        <path d="M12 21.5V17" />
        <path d="M9 14h6" />
        <path d="m15 11.5-3-3-3 3" />
    </svg>
);

export default AccessibilityIcon;

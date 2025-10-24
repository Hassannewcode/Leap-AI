import React from 'react';

const TracingIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M18 6.2c-2.4 2.4-2.4 5.9 0 8.3"/>
        <path d="M12.5 12.5c-2.4-2.4-2.4-5.9 0-8.3"/>
        <path d="M6 18c2.4-2.4 2.4-5.9 0-8.3"/>
        <path d="m18 18-5.5-5.5"/>
        <path d="m6 6 5.5 5.5"/>
    </svg>
);

export default TracingIcon;
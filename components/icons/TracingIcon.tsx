import React from 'react';

const TracingIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M4 12h16" />
        <path d="M4 18h12" />
        <path d="M4 6h16" />
        <path d="M12 4v16" />
    </svg>
);

export default TracingIcon;

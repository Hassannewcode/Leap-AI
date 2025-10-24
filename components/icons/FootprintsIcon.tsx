import React from 'react';

const FootprintsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-5 4.5-5C9.37 3 11 4.5 11 6.5c0 1.5-1 2.5-2 2.5-1.28 0-2.03.3-4 2.3Z"/>
        <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-5-4.5-5C14.63 7 13 8.5 13 10.5c0 1.5 1 2.5 2 2.5 1.28 0 2.03.3 4 2.3Z"/>
        <path d="M16 17.5c-1.5.67-3,1.5-3,2.5"/>
        <path d="M11.5 14.5c-1.5.67-3,1.5-3,2.5"/>
    </svg>
);

export default FootprintsIcon;
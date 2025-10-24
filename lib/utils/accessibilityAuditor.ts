// --- LeapGuard Accessibility Auditor ---
// A lightweight, non-comprehensive audit for common accessibility issues.
import { AccessibilityIssue } from '../../types';

const generateSelector = (element: Element): string => {
    if (element.id) return `#${element.id}`;
    const path: string[] = [];
    let current: Element | null = element;
    while(current) {
        let selector = current.tagName.toLowerCase();
        if (current.className && typeof current.className === 'string' && current.className.trim() !== '') {
            selector += `.${current.className.split(' ').filter(Boolean).join('.')}`;
        }
        path.unshift(selector);
        current = current.parentElement;
    }
    return path.join(' > ');
};

export const runAccessibilityAudit = (): AccessibilityIssue[] => {
    const issues: AccessibilityIssue[] = [];
    if (typeof document === 'undefined' || !document.querySelectorAll) return issues;
    
    try {
        // Check for images without alt text
        document.querySelectorAll('img:not([alt])').forEach(el => {
            issues.push({
                severity: 'critical',
                message: 'Image is missing an "alt" attribute, which is crucial for screen readers.',
                element: generateSelector(el),
            });
        });

        // Check for buttons without discernible text
        document.querySelectorAll('button').forEach(el => {
            const text = el.textContent?.trim();
            const ariaLabel = el.getAttribute('aria-label');
            if (!text && !ariaLabel) {
                issues.push({
                    severity: 'warning',
                    message: 'Button has no text content or aria-label, making it unidentifiable to assistive technologies.',
                    element: generateSelector(el),
                });
            }
        });
        
        // Check for links without href
        document.querySelectorAll('a:not([href])').forEach(el => {
            issues.push({
                severity: 'warning',
                message: 'Link (<a>) is missing the "href" attribute, making it non-functional.',
                element: generateSelector(el),
            });
        });
    } catch (e) {
        console.error("Error during accessibility audit:", e);
    }

    return issues;
};

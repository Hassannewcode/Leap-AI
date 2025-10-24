import { AccessibilityIssue } from '../../types';
import { generateSelector } from './activityLogger'; // Re-use the selector generator

const hasTextContent = (node: Element): boolean => {
    return (node.textContent || "").trim().length > 0 ||
           node.getAttribute('aria-label')?.trim().length > 0 ||
           node.getAttribute('title')?.trim().length > 0;
};

export const runAccessibilityAudit = (): AccessibilityIssue[] => {
    const issues: AccessibilityIssue[] = [];
    if (typeof document === 'undefined') return issues;

    // 1. Check for images without alt text
    document.querySelectorAll('img:not([alt]), img[alt=""]').forEach(el => {
        issues.push({
            selector: generateSelector(el),
            issue: 'Image missing alt text',
            element: el.outerHTML.substring(0, 100) + '...'
        });
    });

    // 2. Check for buttons without discernible text
    document.querySelectorAll('button').forEach(el => {
        if (!hasTextContent(el) && el.querySelectorAll('img[alt], svg[aria-label]').length === 0) {
             issues.push({
                selector: generateSelector(el),
                issue: 'Button has no discernible text',
                element: el.outerHTML.substring(0, 100) + '...'
            });
        }
    });

    // 3. Check for links without discernible text
    document.querySelectorAll('a').forEach(el => {
        if (!hasTextContent(el) && el.querySelectorAll('img[alt], svg[aria-label]').length === 0) {
             issues.push({
                selector: generateSelector(el),
                issue: 'Link has no discernible text',
                element: el.outerHTML.substring(0, 100) + '...'
            });
        }
    });

    return issues;
};
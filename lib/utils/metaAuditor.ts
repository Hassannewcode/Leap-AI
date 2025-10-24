// --- LeapGuard Meta & SEO Auditor ---
// A lightweight audit for common meta tags.
import { MetaIssue } from '../../types';


export const runMetaAudit = (): MetaIssue[] => {
    const issues: MetaIssue[] = [];
    if (typeof document === 'undefined' || !document.head) return issues;

    const head = document.head;

    try {
        // Check for title
        const title = head.querySelector('title');
        if (!title || !title.textContent?.trim()) {
            issues.push({
                severity: 'critical',
                message: 'The <title> tag is missing or empty. This is essential for SEO and browser tab identification.',
                tag: '<title>',
            });
        }
        
        // Check for meta description
        const description = head.querySelector('meta[name="description"]');
        if (!description || !description.getAttribute('content')?.trim()) {
            issues.push({
                severity: 'warning',
                message: 'The meta description is missing or empty. This is important for search engine results.',
                tag: '<meta name="description">',
            });
        }

        // Check for Open Graph tags (common ones)
        const ogTags = ['og:title', 'og:description', 'og:image'];
        ogTags.forEach(prop => {
            const tag = head.querySelector(`meta[property="${prop}"]`);
            if (!tag || !tag.getAttribute('content')?.trim()) {
                issues.push({
                    severity: 'warning',
                    message: `The Open Graph tag "${prop}" is missing or empty. This affects how your content appears when shared on social media.`,
                    tag: `<meta property="${prop}">`,
                });
            }
        });

        // Check for viewport
        const viewport = head.querySelector('meta[name="viewport"]');
        if (!viewport || !viewport.getAttribute('content')?.trim()) {
            issues.push({
                severity: 'critical',
                message: 'The viewport meta tag is missing, which can cause rendering issues on mobile devices.',
                tag: '<meta name="viewport">',
            });
        }
    } catch (e) {
        console.error("Error during meta audit:", e);
    }

    return issues;
};

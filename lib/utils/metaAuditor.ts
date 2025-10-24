import { MetaIssue } from '../../types';

const REQUIRED_TAGS = [
    { type: 'name', value: 'description' },
    { type: 'property', value: 'og:title' },
    { type: 'property', value: 'og:description' },
    { type: 'property', value: 'og:image' },
    { type: 'property', value: 'og:type' },
];

export const runMetaAudit = (): MetaIssue[] => {
    const issues: MetaIssue[] = [];
    if (typeof document === 'undefined') return issues;

    REQUIRED_TAGS.forEach(tagInfo => {
        const selector = `meta[${tagInfo.type}="${tagInfo.value}"]`;
        const element = document.querySelector(selector) as HTMLMetaElement | null;

        if (!element) {
            issues.push({
                tag: tagInfo.value,
                issue: 'Meta tag is missing'
            });
        } else if (!element.content || element.content.trim() === '') {
            issues.push({
                tag: tagInfo.value,
                issue: 'Meta tag content is empty'
            });
        }
    });

    // Check for title tag
    const titleElement = document.querySelector('title');
    if (!titleElement || !titleElement.textContent || titleElement.textContent.trim() === '') {
        issues.push({
            tag: 'title',
            issue: '<title> tag is missing or empty'
        });
    }

    return issues;
};

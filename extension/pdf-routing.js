/** Route only top-level DMV attachments, before Chromium paints its native PDF viewer. */
import {attachmentUrl} from './core.js';
export const PDF_DARK_RULE_ID = 1700;
export function darkResultSource(url, readerUrl) {
  try {
    const u = new URL(url), reader = new URL(readerUrl);
    if (u.protocol !== reader.protocol || u.host !== reader.host || u.pathname !== reader.pathname || u.searchParams.get('pdf') !== '1') return null;
    return attachmentUrl(u.hash.slice(1));
  } catch { return null; }
}
export function pdfDarkRule(readerUrl) {
  return {id: PDF_DARK_RULE_ID, priority: 1,
    action: {type: 'redirect', redirect: {regexSubstitution: `${readerUrl}?dark=1&pdf=1#\\0`}},
    condition: {regexFilter: '^https://www\\.scdmvonline\\.com/SCTRNS/Member/Transactions/ViewAttachment\\.aspx([?].*)?$', isUrlFilterCaseSensitive: false, resourceTypes: ['main_frame']}};
}
export async function setPdfRouting(enabled) {
  await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds: [PDF_DARK_RULE_ID], addRules: enabled ? [pdfDarkRule(chrome.runtime.getURL('reader.html'))] : []});
}

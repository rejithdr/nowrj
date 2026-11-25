/**
 * Listener text (questions, request messages) may not carry contact details:
 * no phone numbers, email addresses, links or web addresses.
 */
const PHONE = /(?:\+?\d[\s().-]*){7,}/;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const LINK = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|in|net|org|io|me|co|info|xyz|ly|app|link|site|online|biz)\b/i;

export const CONTACT_RULE_MESSAGE = 'Please remove phone numbers, email addresses and links.';

export function hasContactDetails(text: string | null | undefined): boolean {
  if (!text) return false;
  // Callers limit length first; this cap keeps the patterns cheap even if one forgets.
  const t = text.length > 2000 ? text.slice(0, 2000) : text;
  return PHONE.test(t) || EMAIL.test(t) || LINK.test(t);
}

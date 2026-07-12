/**
 * Mask a sensitive string for safe display.
 * Returns "***" if the value is non-empty, empty string otherwise.
 */
export function maskSecret(value: string | null | undefined): string {
  if (!value || value.trim() === "") return "";
  return "***";
}

/**
 * List of fields in Settings that contain secrets.
 */
export const SECRET_FIELDS = [
  "aiApiKey",
  "smtpPass",
  "imapPass",
  "twilioToken",
  "elevenLabsKey",
  "whatsappApiKey",
] as const;

/**
 * Remove secret values from a settings object for API responses.
 * Returns a new object with secrets replaced by "***".
 */
export function maskSettingsSecrets<T extends Record<string, unknown>>(
  settings: T
): T {
  const masked = { ...settings };
  for (const field of SECRET_FIELDS) {
    if (field in masked) {
      masked[field as keyof T] = maskSecret(
        masked[field as keyof T] as string
      ) as T[keyof T];
    }
  }
  return masked;
}

/**
 * Escape HTML entities to prevent XSS in email/HTML output.
 * Note: Do NOT use this for React/JSX rendering (handled automatically).
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/\x26/g, "\x26\x61\x6d\x70\x3b")
    .replace(/\x3c/g, "\x26\x6c\x74\x3b")
    .replace(/\x3e/g, "\x26\x67\x74\x3b")
    .replace(/\x22/g, "\x26\x71\x75\x6f\x74\x3b")
    .replace(/\x27/g, "\x26\x23\x78\x32\x37\x3b");
}

export function sanitizeEmailSubject(subject: string): string {
  return subject.replace(/[\r\n]/g, " ").trim();
}

export type PairingCodePayload =
  | string
  | {
      code?: unknown;
      pairingCode?: unknown;
      pairCode?: unknown;
      data?: unknown;
      result?: unknown;
      message?: unknown;
    };

function cleanupCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").trim();
}

export function extractPairingCode(payload: unknown): string | null {
  if (typeof payload === "string") {
    const normalized = payload.trim();
    if (!normalized || normalized.toLowerCase() === "service unavailable") {
      return null;
    }

    const match = normalized.match(/(?:code|pairing code)\s*[:=]?\s*([A-Za-z0-9\-]{3,})/i);
    if (match?.[1]) {
      const cleaned = cleanupCode(match[1]);
      return cleaned || null;
    }

    const cleaned = cleanupCode(normalized);
    return cleaned.length >= 3 ? cleaned : null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const extracted = extractPairingCode(item);
      if (extracted) {
        return extracted;
      }
    }
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidates = [
      record.code,
      record.pairingCode,
      record.pairCode,
      record.data,
      record.result,
      record.message,
    ];
    for (const candidate of candidates) {
      const extracted = extractPairingCode(candidate);
      if (extracted) {
        return extracted;
      }
    }
  }

  return null;
}

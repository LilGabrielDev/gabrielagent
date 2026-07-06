export type PairingCodePayload =
  | string
  | { code?: unknown; pairingCode?: unknown; data?: unknown; message?: unknown };

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

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidates = [record.code, record.pairingCode, record.data, record.message];
    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        const extracted = extractPairingCode(candidate);
        if (extracted) {
          return extracted;
        }
      }
      if (candidate && typeof candidate === "object") {
        const nested = candidate as Record<string, unknown>;
        const nestedCode = nested.code ?? nested.pairingCode ?? nested.message;
        if (typeof nestedCode === "string") {
          const extracted = extractPairingCode(nestedCode);
          if (extracted) {
            return extracted;
          }
        }
      }
    }
  }

  return null;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") || "";

export function getBackendUrl(): string {
  if (!BACKEND_URL) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL is not configured");
  }
  return BACKEND_URL;
}

export function getBackendHttpUrl(path = ""): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBackendUrl()}${normalizedPath}`;
}

export async function backendRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(getBackendHttpUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `Backend request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

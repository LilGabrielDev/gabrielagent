import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("WhatsApp channel service client", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      WHATSAPP_SERVICE_URL: "https://wa.example.com",
      WHATSAPP_SERVICE_API_KEY: "test-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("reports configured when WHATSAPP_SERVICE_URL is set", async () => {
    const { isWhatsAppServiceConfigured } = await import("@/lib/channels/whatsapp");
    expect(isWhatsAppServiceConfigured()).toBe(true);
  });

  it("maps remote pairing status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            connected: false,
            status: "waiting",
            pairingCode: "ABCD1234",
            sessionId: "default",
          }),
      })
    );

    const { getWhatsAppStatus } = await import("@/lib/channels/whatsapp");
    const status = await getWhatsAppStatus();

    expect(status.status).toBe("pairing_ready");
    expect(status.pairingCode).toBe("ABCD1234");
  });

  it("starts QR mode via whatsapp-service", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            success: true,
            sessionId: "default",
            qr: "2@abc",
            status: "waiting",
          }),
      })
    );

    const { initWhatsApp } = await import("@/lib/channels/whatsapp");
    const status = await initWhatsApp("web");

    expect(status.mode).toBe("web");
    expect(status.status).toBe("qr_ready");
    expect(status.qr).toMatch(/^data:image\/png;base64,/);
  });

  it("calls logout on disconnect", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { disconnectWhatsApp } = await import("@/lib/channels/whatsapp");
    const status = await disconnectWhatsApp();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://wa.example.com/api/whatsapp/logout/default",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(status.status).toBe("disconnected");
  });
});

import { describe, expect, it } from "vitest";
import { extractPairingCode } from "@/lib/channels/pairing-code";

describe("extractPairingCode", () => {
  it("parses a JSON payload with a code field", () => {
    expect(extractPairingCode({ code: "123456" })).toBe("123456");
  });

  it("parses a plain-text knight-style payload", () => {
    expect(extractPairingCode("Pairing code: 123456")).toBe("123456");
  });

  it("returns null when the service reports it is unavailable", () => {
    expect(extractPairingCode("service unavailable")).toBeNull();
  });
});

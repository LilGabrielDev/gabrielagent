import { describe, expect, it } from "vitest";
import { extractPairingCode } from "@/lib/channels/pairing-code";

describe("extractPairingCode", () => {
  it("parses a JSON payload with a code field", () => {
    expect(extractPairingCode({ code: "123456" })).toBe("123456");
  });

  it("parses nested service payloads", () => {
    expect(extractPairingCode({ data: { pairingCode: "123-456" } })).toBe(
      "123456"
    );
  });

  it("parses result and pairCode service payloads", () => {
    expect(extractPairingCode({ result: { pairCode: "ABCD-1234" } })).toBe(
      "ABCD1234"
    );
  });

  it("parses a plain-text knight-style payload", () => {
    expect(extractPairingCode("Pairing code: 123456")).toBe("123456");
  });

  it("returns null when the service reports it is unavailable", () => {
    expect(extractPairingCode("service unavailable")).toBeNull();
  });
});

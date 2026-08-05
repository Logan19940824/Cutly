import { describe, expect, it, vi } from "vitest";
import { createIdempotencyKey } from "./client-id";

describe("createIdempotencyKey", () => {
  it("uses the native UUID implementation when available", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const getRandomValues = vi.fn();
    const cryptoApi = { randomUUID: () => id, getRandomValues } as unknown as Crypto;

    expect(createIdempotencyKey(cryptoApi)).toBe(id);
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it("creates a UUID v4 when randomUUID is unavailable", () => {
    const cryptoApi = {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(0),
    } as unknown as Crypto;

    expect(createIdempotencyKey(cryptoApi)).toBe("00000000-0000-4000-8000-000000000000");
  });
});

import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { exportImage } from "./image-export";

describe("exportImage", () => {
  it("crops transparent edges and preserves the subject ratio", async () => {
    const subject = await sharp({ create: { width: 40, height: 20, channels: 4, background: "#e33d3d" } }).png().toBuffer();
    const source = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: subject, left: 30, top: 40 }]).png().toBuffer();
    const result = await exportImage(source, { width: 1000, height: 1000, fit: "contain", format: "png", background: "transparent", cropToSubject: true });

    await expect(sharp(result.cropped).metadata()).resolves.toMatchObject({ width: 40, height: 20 });
    expect(result.output.info).toMatchObject({ width: 1000, height: 500 });
  });
});

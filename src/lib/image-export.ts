import sharp from "sharp";

export type ExportParams = {
  width: number;
  height: number;
  fit: "contain" | "cover";
  format: "png" | "webp" | "jpeg";
  background: string;
  cropToSubject: boolean;
};

export async function exportImage(cutout: Buffer, params: ExportParams) {
  const cropped = params.cropToSubject
    ? await sharp(cutout).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 }).png().toBuffer()
    : cutout;
  const background = params.background === "transparent" ? { r: 0, g: 0, b: 0, alpha: 0 } : params.background;
  let pipeline = params.cropToSubject
    ? sharp(cropped).resize({ width: params.width, height: params.height, fit: "inside" })
    : sharp(cropped).resize(params.width, params.height, { fit: params.fit, background });

  if (params.background !== "transparent") pipeline = pipeline.flatten({ background: params.background });
  if (params.format === "png") pipeline = pipeline.png();
  if (params.format === "webp") pipeline = pipeline.webp({ quality: 90 });
  if (params.format === "jpeg") pipeline = pipeline.jpeg({ quality: 92 });
  return { cropped, output: await pipeline.toBuffer({ resolveWithObject: true }) };
}

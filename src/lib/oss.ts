import OSS from "ali-oss";

function config() {
  const region = process.env.ALIYUN_OSS_REGION;
  const bucket = process.env.ALIYUN_OSS_BUCKET;
  const accessKeyId = process.env.ALIYUN_OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET;
  if (!region || !bucket || !accessKeyId || !accessKeySecret) throw new Error("OSS_NOT_CONFIGURED");
  return { region, bucket, accessKeyId, accessKeySecret };
}

export function ossClient() { return new OSS(config()); }

export async function createUploadUrl(key: string, mimeType: string) {
  return ossClient().signatureUrl(key, { method: "PUT", expires: 300, "Content-Type": mimeType });
}

export async function createReadUrl(key: string, downloadName?: string) {
  return ossClient().signatureUrl(key, {
    expires: 300,
    ...(downloadName ? { response: { "content-disposition": `attachment; filename="${downloadName.replace(/[^a-zA-Z0-9._-]/g, "_")}"` } } : {}),
  });
}

export async function inspectObject(key: string) {
  const result = await ossClient().head(key);
  const headers = result.res.headers as Record<string, string | number | undefined>;
  return { size: Number(headers["content-length"] ?? 0), type: String(headers["content-type"] ?? "") };
}

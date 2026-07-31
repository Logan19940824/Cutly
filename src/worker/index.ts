import { Worker } from "bullmq";
import IORedis from "ioredis";
import sharp from "sharp";
import ImagesegClient, { SegmentCommonImageRequest } from "@alicloud/imageseg20191230";
import { Config } from "@alicloud/openapi-client";
import { db } from "../lib/db";
import { exportImage, type ExportParams } from "../lib/image-export";
import { ossClient } from "../lib/oss";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("REDIS_URL is required");

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ time: new Date().toISOString(), event, ...data }));
}

async function removeBackground(storageKey: string, jobId: string) {
  const accessKeyId = process.env.ALIYUN_VIAPI_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_VIAPI_ACCESS_KEY_SECRET;
  const regionId = process.env.ALIYUN_VIAPI_REGION ?? "cn-shanghai";
  const endpoint = process.env.ALIYUN_VIAPI_ENDPOINT ?? "imageseg.cn-shanghai.aliyuncs.com";
  if (!accessKeyId || !accessKeySecret) throw new Error("ALIYUN_VIAPI_NOT_CONFIGURED");

  const client = new ImagesegClient(new Config({ accessKeyId, accessKeySecret, regionId, endpoint }));
  const oss = ossClient();
  const source = await oss.get(storageKey);
  let prepared = await sharp(Buffer.from(source.content))
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  if (prepared.length >= 2_900_000) {
    prepared = await sharp(prepared).jpeg({ quality: 72, mozjpeg: true }).toBuffer();
  }
  if (prepared.length >= 3_000_000) throw new Error("ALIYUN_VIAPI_INPUT_STILL_TOO_LARGE");

  const preparedKey = `temp/viapi/${jobId}.jpg`;
  await oss.put(preparedKey, prepared, { headers: { "Content-Type": "image/jpeg" } });
  log("viapi_input_prepared", { jobId, originalBytes: source.content.length, preparedBytes: prepared.length });

  try {
    const imageURL = oss.signatureUrl(preparedKey, { method: "GET", expires: 600 });
    const result = await client.segmentCommonImage(new SegmentCommonImageRequest({ imageURL }));
    const outputURL = result.body?.data?.imageURL;
    if (!outputURL) throw new Error("ALIYUN_VIAPI_EMPTY_RESULT");

    const response = await fetch(outputURL);
    if (!response.ok) throw new Error(`ALIYUN_RESULT_DOWNLOAD_${response.status}`);
    return { cutout: Buffer.from(await response.arrayBuffer()), requestId: result.body?.requestId };
  } finally {
    await oss.delete(preparedKey).catch((error) => log("viapi_temp_cleanup_failed", { jobId, error: String(error) }));
  }
}

async function processJob(jobId: string) {
  const job = await db.imageJob.findUnique({ where: { id: jobId }, include: { sourceAsset: true } });
  if (!job || job.status === "SUCCEEDED" || job.status === "CANCELED") {
    log("job_skipped", { jobId, status: job?.status ?? "NOT_FOUND" });
    return;
  }
  log("job_started", { jobId, attempt: job.attemptCount + 1, provider: job.provider });
  await db.imageJob.update({ where: { id: job.id }, data: { status: "PROCESSING", startedAt: new Date(), attemptCount: { increment: 1 }, errorCode: null, errorMessage: null } });
  try {
    const { cutout, requestId } = await removeBackground(job.sourceAsset.storageKey, job.id);
    if (requestId) await db.imageJob.update({ where: { id: job.id }, data: { providerRequestId: requestId } });
    const params = job.params as ExportParams;
    const { cropped, output } = await exportImage(cutout, { ...params, cropToSubject: params.cropToSubject ?? false });
    const cutoutKey = `assets/${job.userId}/${job.id}/cutout.png`;
    const outputKey = `assets/${job.userId}/${job.id}/export.${params.format === "jpeg" ? "jpg" : params.format}`;
    await ossClient().put(cutoutKey, cropped);
    await ossClient().put(outputKey, output.data);
    await db.$transaction(async (tx) => {
      const cutoutAsset = await tx.imageAsset.create({ data: { userId: job.userId, kind: "CUTOUT", parentAssetId: job.sourceAssetId, storageKey: cutoutKey, mimeType: "image/png", byteSize: cropped.length } });
      const exportAsset = await tx.imageAsset.create({ data: { userId: job.userId, kind: "EXPORT", parentAssetId: cutoutAsset.id, storageKey: outputKey, mimeType: `image/${params.format}`, width: output.info.width, height: output.info.height, byteSize: output.data.length } });
      await tx.jobOutput.createMany({ data: [{ jobId: job.id, assetId: cutoutAsset.id }, { jobId: job.id, assetId: exportAsset.id }] });
      await tx.imageJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", finishedAt: new Date() } });
      await tx.creditAccount.update({ where: { userId: job.userId }, data: { held: { decrement: 1 }, version: { increment: 1 } } });
      await tx.creditLedger.create({ data: { userId: job.userId, type: "JOB_CAPTURE", availableDelta: 0, heldDelta: -1, referenceType: "IMAGE_JOB", referenceId: job.id, idempotencyKey: `job-capture:${job.id}` } });
    });
    log("job_succeeded", { jobId, requestId, outputBytes: output.data.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    log("job_attempt_failed", { jobId, attempt: job.attemptCount + 1, error: message });
    await db.imageJob.update({ where: { id: job.id }, data: { status: "RETRYING", errorCode: message.slice(0, 80), errorMessage: message.slice(0, 500) } });
    throw error;
  }
}

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const worker = new Worker("image-processing", async (queueJob) => processJob(queueJob.data.jobId), { connection, concurrency: 2 });

worker.on("failed", async (queueJob, error) => {
  if (!queueJob) return;
  if (queueJob.attemptsMade < (queueJob.opts.attempts ?? 1)) {
    log("job_retry_scheduled", { jobId: queueJob.data.jobId, attemptsMade: queueJob.attemptsMade, error: error.message });
    return;
  }
  const jobId = String(queueJob.data.jobId);
  const imageJob = await db.imageJob.findUnique({ where: { id: jobId } });
  if (!imageJob || imageJob.status === "SUCCEEDED") return;
  await db.$transaction(async (tx) => {
    await tx.imageJob.update({ where: { id: jobId }, data: { status: "FAILED", finishedAt: new Date(), errorMessage: error.message.slice(0, 500) } });
    await tx.creditAccount.update({ where: { userId: imageJob.userId }, data: { available: { increment: 1 }, held: { decrement: 1 }, version: { increment: 1 } } });
    await tx.creditLedger.create({ data: { userId: imageJob.userId, type: "JOB_RELEASE", availableDelta: 1, heldDelta: -1, referenceType: "IMAGE_JOB", referenceId: jobId, idempotencyKey: `job-release:${jobId}` } });
  });
  log("job_failed", { jobId, attemptsMade: queueJob.attemptsMade, error: error.message });
});

log("worker_started", { concurrency: 2 });

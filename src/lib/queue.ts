import { Queue } from "bullmq";
import IORedis from "ioredis";

const globalQueue = globalThis as unknown as { imageQueue?: Queue };

function connection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_NOT_CONFIGURED");
  return new IORedis(url, { maxRetriesPerRequest: null });
}

export function imageQueue() {
  globalQueue.imageQueue ??= new Queue("image-processing", { connection: connection() });
  return globalQueue.imageQueue;
}

export async function enqueueImageJob(jobId: string) {
  await imageQueue().add("process", { jobId }, { jobId, attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 100, removeOnFail: 500 });
}

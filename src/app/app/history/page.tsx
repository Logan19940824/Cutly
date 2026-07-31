import Image from "next/image";
import { Clock3, Download, LoaderCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const statusText: Record<string, string> = { PENDING: "等待中", QUEUED: "排队中", PROCESSING: "处理中", RETRYING: "重试中", SUCCEEDED: "已完成", FAILED: "失败", CANCELED: "已取消" };

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const jobs = await db.imageJob.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50,
    include: { outputs: { include: { asset: true } } },
  });
  return <AppShell email={user.email} credits={user.creditAccount?.available} admin={user.role === "ADMIN"}>
    <header className="topbar"><div><p className="eyebrow">作品库</p><h1>处理记录</h1></div><Link className="button primary" href="/app">处理新图片</Link></header>
    <section className="history-content">{jobs.length ? <div className="history-grid">{jobs.map((job) => {
      const output = job.outputs.find(({ asset }) => asset.kind === "EXPORT")?.asset;
      const params = job.params as { width?: number; height?: number; format?: string };
      const active = ["PENDING", "QUEUED", "PROCESSING", "RETRYING"].includes(job.status);
      return <article className="history-card" key={job.id}>
        <div className="history-thumb">{output ? <Image src={`/api/v1/assets/${output.id}`} alt="处理结果" fill sizes="(max-width: 560px) 96px, 128px" unoptimized /> : active ? <LoaderCircle className="spin" /> : <RotateCcw />}</div>
        <div className="history-meta"><span className={`job-status status-${job.status.toLowerCase()}`}>{statusText[job.status]}</span><h2>背景移除</h2><p>{params.width ?? "-"} × {params.height ?? "-"} · {(params.format ?? "png").toUpperCase()}</p><small>{job.createdAt.toLocaleString("zh-CN")}</small>{job.status === "FAILED" && <p className="job-error">{job.errorMessage || "处理失败，请重新上传图片"}</p>}</div>
        <div className="history-actions">{output ? <><a className="button primary" href={`/api/v1/assets/${output.id}?download=1`}><Download size={17} />下载</a><a className="button secondary" href={`/api/v1/assets/${output.id}`} target="_blank" rel="noreferrer">查看大图</a></> : job.status === "FAILED" ? <Link className="button secondary" href="/app"><RotateCcw size={17} />重新处理</Link> : <span className="muted">完成后可下载</span>}</div>
      </article>;
    })}</div> : <div className="empty-recent large"><div><Clock3 /></div><h3>暂无处理记录</h3><p>完成的抠图和导出任务会集中保存在这里。</p><Link className="button primary" href="/app">处理第一张图片</Link></div>}</section>
  </AppShell>;
}

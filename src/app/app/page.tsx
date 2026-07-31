import Image from "next/image";
import { ArrowRight, Check, Download, LockKeyhole, Sparkles } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Uploader } from "@/components/uploader";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

async function userOrNull() { try { return await getCurrentUser(); } catch { return null; } }

export default async function WorkspacePage() {
  const user = await userOrNull();
  const recent = user ? await db.imageJob.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 3,
    include: { outputs: { include: { asset: true } } },
  }) : [];

  return <AppShell email={user?.email} credits={user?.creditAccount?.available} admin={user?.role === "ADMIN"}>
    <header className="topbar"><div><p className="eyebrow">工作台</p><h1>创建透明背景图片</h1></div><div className="credit-pill"><Sparkles size={15} />{user ? `剩余 ${user.creditAccount?.available ?? 0} 次` : "登录后赠 3 次"}</div></header>
    <section className="work-content">
      <Uploader loggedIn={Boolean(user)} hasCredits={(user?.creditAccount?.available ?? 0) > 0} />
      <section className="recent-section"><div className="section-title"><div><h2>最近处理</h2><p>完成后可随时预览和再次下载</p></div>{user && <Link href="/app/history">查看全部 <ArrowRight size={15} /></Link>}</div>
        {recent.length ? <div className="recent-grid">{recent.map((job) => {
          const output = job.outputs.find(({ asset }) => asset.kind === "EXPORT")?.asset;
          return <article className="recent-card" key={job.id}>
            <div className="recent-thumb">{output ? <Image src={`/api/v1/assets/${output.id}`} alt="处理结果" fill sizes="240px" unoptimized /> : <span className={`job-status status-${job.status.toLowerCase()}`}>{job.status === "FAILED" ? "失败" : "处理中"}</span>}</div>
            <div><strong>背景移除</strong><small>{job.createdAt.toLocaleString("zh-CN")}</small></div>
            {output && <a className="icon-button asset-download" aria-label="下载图片" title="下载图片" href={`/api/v1/assets/${output.id}?download=1`}><Download size={18} /></a>}
          </article>;
        })}</div> : <div className="empty-recent"><div><LockKeyhole /></div><h3>{user ? "还没有处理记录" : "登录后保存处理记录"}</h3><p>{user ? "上传第一张图片开始创建。" : "注册即可获得 3 次免费高清抠图额度。"}</p>{!user && <Link className="button secondary" href="/register"><Check size={16} />免费注册</Link>}</div>}
      </section>
    </section>
  </AppShell>;
}

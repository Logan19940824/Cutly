import Image from "next/image";
import Link from "next/link";
import { Activity, CircleDollarSign, Download, Images, Search, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { grantMembership, revokeMembership } from "./actions";

const jobStatuses = ["PENDING", "QUEUED", "PROCESSING", "RETRYING", "SUCCEEDED", "FAILED", "CANCELED"] as const;
const statusText: Record<string, string> = { PENDING: "等待中", QUEUED: "排队中", PROCESSING: "处理中", RETRYING: "重试中", SUCCEEDED: "已完成", FAILED: "失败", CANCELED: "已取消" };
const PAGE_SIZE = 20;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(value: string | string[] | undefined) { return typeof value === "string" ? value : ""; }

function Pagination({ page, total, query }: { page: number; total: number; query: URLSearchParams }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages === 1) return null;
  const href = (next: number) => { const params = new URLSearchParams(query); params.set("page", String(next)); return `/admin?${params}`; };
  return <nav className="admin-pagination" aria-label="分页"><Link className={`button secondary ${page <= 1 ? "disabled-link" : ""}`} href={href(Math.max(1, page - 1))}>上一页</Link><span>第 {page} / {pages} 页，共 {total} 条</span><Link className={`button secondary ${page >= pages ? "disabled-link" : ""}`} href={href(Math.min(pages, page + 1))}>下一页</Link></nav>;
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await getCurrentUser();
  if (!admin) redirect("/login");
  if (admin.role !== "ADMIN") redirect("/app");
  const search = await searchParams;
  const view = valueOf(search.view) === "jobs" ? "jobs" : "users";
  const q = valueOf(search.q).trim().slice(0, 100);
  const requestedStatus = valueOf(search.status);
  const status = jobStatuses.find((item) => item === requestedStatus);
  const page = Math.max(1, Number.parseInt(valueOf(search.page), 10) || 1);
  const [userCount, jobCount, failedJobs, activeMemberships] = await Promise.all([
    db.user.count(), db.imageJob.count(), db.imageJob.count({ where: { status: "FAILED" } }),
    db.membership.count({ where: { status: "ACTIVE", endsAt: { gt: new Date() } } }),
  ]);
  const stats = [{ label: "注册用户", value: userCount, icon: Users }, { label: "图片任务", value: jobCount, icon: Images }, { label: "失败任务", value: failedJobs, icon: Activity }, { label: "有效会员", value: activeMemberships, icon: CircleDollarSign }];
  const query = new URLSearchParams({ view, ...(q ? { q } : {}), ...(status ? { status } : {}) });

  const userWhere = q ? { email: { contains: q, mode: "insensitive" as const } } : {};
  const jobWhere = { ...(q ? { user: { email: { contains: q, mode: "insensitive" as const } } } : {}), ...(status ? { status } : {}) };
  const [users, matchingUsers, jobs, matchingJobs] = await Promise.all([
    view === "users" ? db.user.findMany({
      where: userWhere, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { creditAccount: true, memberships: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { jobs: true } } },
    }) : Promise.resolve([]),
    view === "users" ? db.user.count({ where: userWhere }) : Promise.resolve(0),
    view === "jobs" ? db.imageJob.findMany({
      where: jobWhere, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { user: { select: { email: true } }, outputs: { include: { asset: true } } },
    }) : Promise.resolve([]),
    view === "jobs" ? db.imageJob.count({ where: jobWhere }) : Promise.resolve(0),
  ]);

  return <AppShell email={admin.email} credits={admin.creditAccount?.available} admin>
    <header className="topbar"><div><p className="eyebrow">运营管理</p><h1>管理后台</h1></div></header>
    <section className="admin-content">
      <div className="admin-stats">{stats.map(({ label, value, icon: Icon }) => <article key={label}><span><Icon /></span><div><small>{label}</small><strong>{value}</strong></div></article>)}</div>
      <nav className="admin-tabs"><Link className={view === "users" ? "active" : ""} href="/admin?view=users">用户与订阅</Link><Link className={view === "jobs" ? "active" : ""} href="/admin?view=jobs">全部生成记录</Link></nav>
      {valueOf(search.notice) && <p className="admin-notice">{valueOf(search.notice)}</p>}
      {valueOf(search.error) && <p className="form-error">{valueOf(search.error)}</p>}

      <form className="admin-filters" method="get"><input type="hidden" name="view" value={view} /><label><Search size={16} /><input name="q" defaultValue={q} placeholder="搜索用户邮箱" /></label>{view === "jobs" && <select name="status" defaultValue={status ?? ""} aria-label="任务状态"><option value="">全部状态</option>{jobStatuses.map((item) => <option key={item} value={item}>{statusText[item]}</option>)}</select>}<button className="button secondary">查询</button>{(q || status) && <Link className="button ghost" href={`/admin?view=${view}`}>清除</Link>}</form>

      {view === "users" ? <><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>用户</th><th>订阅状态</th><th>额度 / 任务</th><th>注册时间</th><th>操作</th></tr></thead><tbody>{users.map((user) => {
        const membership = user.memberships[0];
        const active = membership?.status === "ACTIVE" && membership.endsAt > new Date();
        return <tr key={user.id}><td><strong>{user.email}</strong><small>{user.role} · {user.status}</small></td><td>{membership ? <><span className={`membership-badge ${active ? "active" : ""}`}>{active ? membership.planCode : membership.status === "REVOKED" ? "已撤销" : "已过期"}</span><small>至 {membership.endsAt.toLocaleDateString("zh-CN")}</small></> : <span className="membership-badge">免费用户</span>}</td><td><strong>{user.creditAccount?.available ?? 0} 次</strong><small>{user._count.jobs} 个任务</small></td><td>{user.createdAt.toLocaleDateString("zh-CN")}</td><td><details className="admin-actions"><summary>管理订阅</summary><form action={grantMembership}><input type="hidden" name="userId" value={user.id} /><select name="planCode" aria-label="会员套餐" defaultValue="PRO_MONTHLY"><option value="PRO_MONTHLY">专业版月卡</option><option value="PRO_YEARLY">专业版年卡</option></select><input name="reason" required minLength={2} maxLength={200} placeholder="开通原因" /><button className="button primary">开通 / 替换</button></form>{active && <form action={revokeMembership}><input type="hidden" name="membershipId" value={membership.id} /><input name="reason" required minLength={2} maxLength={200} placeholder="撤销原因" /><button className="button danger-button">撤销会员</button></form>}</details></td></tr>;
      })}</tbody></table>{!users.length && <p className="admin-empty">没有找到用户</p>}</div><Pagination page={page} total={matchingUsers} query={query} /></> : <><div className="admin-table-wrap"><table className="admin-table jobs"><thead><tr><th>成品</th><th>用户</th><th>任务</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>{jobs.map((job) => {
        const output = job.outputs.find(({ asset }) => asset.kind === "EXPORT")?.asset;
        const params = job.params as { width?: number; height?: number; format?: string; cropToSubject?: boolean };
        return <tr key={job.id}><td><div className="admin-thumb">{output ? <Image src={`/api/v1/assets/${output.id}`} alt="生成结果" fill sizes="64px" unoptimized /> : <Images />}</div></td><td><strong>{job.user.email}</strong><small>{job.id.slice(0, 8)}</small></td><td><strong>{params.width ?? "-"} × {params.height ?? "-"}</strong><small>{(params.format ?? "png").toUpperCase()} · {params.cropToSubject ? "自动裁边" : "固定画布"}</small></td><td><span className={`job-status status-${job.status.toLowerCase()}`}>{statusText[job.status]}</span>{job.errorMessage && <small className="job-error">{job.errorMessage}</small>}</td><td>{job.createdAt.toLocaleString("zh-CN")}</td><td>{output ? <div className="admin-output-actions"><a className="icon-button" title="查看大图" aria-label="查看大图" target="_blank" rel="noreferrer" href={`/api/v1/assets/${output.id}`}><Images size={17} /></a><a className="icon-button" title="下载" aria-label="下载" href={`/api/v1/assets/${output.id}?download=1`}><Download size={17} /></a></div> : <span className="muted">暂无成品</span>}</td></tr>;
      })}</tbody></table>{!jobs.length && <p className="admin-empty">没有找到生成记录</p>}</div><Pagination page={page} total={matchingJobs} query={query} /></>}
    </section>
  </AppShell>;
}

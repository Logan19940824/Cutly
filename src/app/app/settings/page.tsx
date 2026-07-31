import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsPage() { const user = await getCurrentUser(); if (!user) redirect("/login"); return <AppShell email={user.email} credits={user.creditAccount?.available} admin={user.role === "ADMIN"}><header className="topbar"><div><p className="eyebrow">账号</p><h1>账号设置</h1></div></header><section className="settings-content"><div className="settings-block"><h2>基本信息</h2><label>登录邮箱<input value={user.email} readOnly /></label><p>邮箱验证和密码重置邮件服务将在生产环境配置后启用。</p></div><div className="settings-block danger"><h2>数据与账号</h2><p>删除图片和注销账号流程将在 OSS 生命周期清理任务接通后开放。</p><button className="button danger-button" disabled>注销账号</button></div></section></AppShell>; }

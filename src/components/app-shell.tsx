"use client";

import { CreditCard, History, LayoutDashboard, LogOut, Scissors, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions";

const navItems = [
  { href: "/app", label: "工作台", icon: LayoutDashboard },
  { href: "/app/history", label: "处理记录", icon: History },
  { href: "/app/billing", label: "会员与额度", icon: CreditCard },
  { href: "/app/settings", label: "账号设置", icon: Settings },
];

export function AppShell({ children, email, credits, admin = false }: { children: React.ReactNode; email?: string; credits?: number; admin?: boolean }) {
  const pathname = usePathname();
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/app" className="brand"><span><Scissors size={19} /></span>Cutly</Link>
      <nav aria-label="主导航">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} className={pathname === href ? "nav-active" : ""} href={href}><Icon />{label}</Link>)}
        {admin && <Link className={pathname === "/admin" ? "nav-active" : ""} href="/admin"><ShieldCheck />管理后台</Link>}
      </nav>
      <div className="sidebar-bottom">{email ? <><div className="account-mini"><span>{email.slice(0, 1).toUpperCase()}</span><div><strong>{email.split("@")[0]}</strong><small>剩余 {credits ?? 0} 次</small></div></div><form action={logout}><button title="退出登录" aria-label="退出登录" className="icon-button"><LogOut size={17} /></button></form></> : <Link className="button primary wide" href="/login">登录 / 注册</Link>}</div>
    </aside>
    <main className="workspace">{children}</main>
  </div>;
}

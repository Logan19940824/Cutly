import { Check, Crown } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/session";

export default async function BillingPage() {
  const user = await getCurrentUser(); if (!user) redirect("/login");
  const plans = [{ name: "免费版", price: "¥0", note: "适合体验核心功能", features: ["注册赠送 3 次抠图", "最大 10MB", "记录保留 7 天"] }, { name: "专业版月卡", price: "¥39", note: "适合个人创作者", featured: true, features: ["每月 200 次抠图", "最大 30MB", "2 个并发任务", "记录保留 30 天"] }, { name: "专业版年卡", price: "¥399", note: "适合高频工作流", features: ["全年 3000 次抠图", "最大 50MB", "4 个并发任务", "记录保留 90 天"] }];
  return <AppShell email={user.email} credits={user.creditAccount?.available} admin={user.role === "ADMIN"}><header className="topbar"><div><p className="eyebrow">会员中心</p><h1>选择适合你的额度</h1></div></header><section className="billing-content"><div className="balance-band"><div><span>当前可用额度</span><strong>{user.creditAccount?.available ?? 0}<small> 次</small></strong></div><div><span>当前套餐</span><strong className="plan-name">免费版</strong></div></div><div className="plan-grid">{plans.map((plan) => <article key={plan.name} className={plan.featured ? "plan featured" : "plan"}>{plan.featured && <span className="popular"><Crown size={14} />推荐</span>}<h2>{plan.name}</h2><p>{plan.note}</p><strong className="price">{plan.price}<small>{plan.price !== "¥0" && " / 期"}</small></strong><ul>{plan.features.map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul><button className={plan.featured ? "button primary wide" : "button secondary wide"} disabled>{plan.name === "免费版" ? "当前套餐" : "支付接入后开放"}</button></article>)}</div></section></AppShell>;
}

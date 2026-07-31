import Link from "next/link";
import { login } from "@/app/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className="auth-form"><div><p className="eyebrow">欢迎回来</p><h2>登录 Cutly</h2><p className="muted">继续处理你的图片和历史任务。</p></div>{error && <p className="form-error">{error}</p>}<form action={login}><label>邮箱<input name="email" type="email" autoComplete="email" required placeholder="name@company.com" /></label><label>密码<input name="password" type="password" autoComplete="current-password" minLength={8} required placeholder="至少 8 位" /></label><div className="form-row"><label className="checkbox"><input type="checkbox" /> 保持登录</label><span className="text-link disabled">忘记密码</span></div><button className="button primary wide">登录</button></form><p className="form-switch">还没有账号？ <Link href="/register">免费注册</Link></p></div>;
}

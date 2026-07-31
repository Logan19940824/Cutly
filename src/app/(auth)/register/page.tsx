import Link from "next/link";
import { register } from "@/app/actions";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className="auth-form"><div><p className="eyebrow">创建账号</p><h2>开始免费处理</h2><p className="muted">注册即赠 3 次高清抠图额度。</p></div>{error && <p className="form-error">{error}</p>}<form action={register}><label>邮箱<input name="email" type="email" autoComplete="email" required placeholder="name@company.com" /></label><label>密码<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required placeholder="至少 8 位" /></label><label className="checkbox terms"><input type="checkbox" required /> 我已阅读并同意服务协议与隐私政策</label><button className="button primary wide">创建账号</button></form><p className="form-switch">已有账号？ <Link href="/login">直接登录</Link></p></div>;
}

import { Scissors } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <Link href="/app" className="brand brand-light"><span><Scissors size={20} /></span>Cutly</Link>
        <div className="auth-copy"><p className="eyebrow">IMAGE WORKSPACE</p><h1>从原图到可用素材，只需几步。</h1><p>自动抠图、精确尺寸和多格式导出，所有历史作品集中管理。</p></div>
        <p className="auth-foot">私有 OSS 存储 · 处理记录可随时删除</p>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}

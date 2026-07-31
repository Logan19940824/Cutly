import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cutly - 智能抠图工作台",
  description: "快速完成图片抠图、尺寸调整和格式导出",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

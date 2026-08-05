"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, ImagePlus, LoaderCircle, RotateCcw, Upload } from "lucide-react";
import { createIdempotencyKey } from "@/lib/client-id";

type Phase = "idle" | "uploading" | "queued" | "processing" | "success" | "failed";
type Output = { id: string; kind: string; mimeType: string; width: number | null; height: number | null; byteSize: number };
type Job = { id: string; status: string; errorMessage: string | null; outputs: { asset: Output }[] };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function Uploader({ loggedIn, hasCredits }: { loggedIn: boolean; hasCredits: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Output | null>(null);
  const [width, setWidth] = useState(1000);
  const [height, setHeight] = useState(1000);
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [format, setFormat] = useState<"png" | "webp" | "jpeg">("png");
  const [transparent, setTransparent] = useState(true);
  const [background, setBackground] = useState("#ffffff");
  const [cropToSubject, setCropToSubject] = useState(true);

  useEffect(() => {
    if (!file) { setLocalPreview(""); return; }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile(next: File | undefined) {
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(next.type) || next.size > 10 * 1024 * 1024) {
      setMessage("请选择 10MB 以内的 JPG、PNG、WebP 或 HEIC 图片");
      setPhase("failed");
      return;
    }
    setFile(next);
    setResult(null);
    setMessage("");
    setPhase("idle");
  }

  function applyPreset(size: number) {
    setWidth(size);
    setHeight(size);
  }

  async function readJson(response: Response) {
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "请求失败，请稍后重试");
    return body;
  }

  async function poll(jobId: string) {
    for (let attempt = 0; attempt < 150; attempt += 1) {
      await wait(2000);
      const { job } = await readJson(await fetch(`/api/v1/jobs/${jobId}`, { cache: "no-store" })) as { job: Job };
      if (job.status === "PROCESSING" || job.status === "RETRYING") {
        setPhase("processing");
        setMessage(job.status === "RETRYING" ? "服务正在自动重试，请稍候…" : "正在移除背景并生成图片…");
      }
      if (job.status === "SUCCEEDED") {
        const output = job.outputs.find(({ asset }) => asset.kind === "EXPORT")?.asset;
        if (!output) throw new Error("任务已完成，但没有找到导出文件");
        setResult(output);
        setPhase("success");
        setMessage("处理完成，可以预览或下载高清图片");
        router.refresh();
        return;
      }
      if (["FAILED", "CANCELED"].includes(job.status)) throw new Error(job.errorMessage || "处理失败，请重试");
    }
    throw new Error("处理时间较长，可稍后到处理记录中查看结果");
  }

  async function submit() {
    if (!loggedIn) return;
    if (!file) return input.current?.click();
    if (!hasCredits) { setPhase("failed"); setMessage("可用额度不足，请先升级会员"); return; }
    setResult(null);
    setPhase("uploading");
    setMessage("正在上传图片…");
    try {
      const signed = await readJson(await fetch("/api/v1/uploads/presign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, size: file.size }),
      }));
      const uploaded = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploaded.ok) throw new Error("上传失败，请检查 OSS 跨域设置后重试");
      setPhase("queued");
      setMessage("图片已上传，正在排队…");
      const { job } = await readJson(await fetch("/api/v1/jobs/remove-background", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageKey: signed.key, idempotencyKey: createIdempotencyKey(), width, height, fit, format,
          background: transparent ? "transparent" : background, cropToSubject,
        }),
      })) as { job: Job };
      await poll(job.id);
    } catch (error) {
      setPhase("failed");
      setMessage(error instanceof Error ? error.message : "处理失败，请重试");
      router.refresh();
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setMessage("");
    setPhase("idle");
    if (input.current) input.current.value = "";
  }

  const busy = ["uploading", "queued", "processing"].includes(phase);
  const resultUrl = result ? `/api/v1/assets/${result.id}` : "";

  if (!loggedIn) return <section className="upload-zone signed-out"><div className="upload-icon"><ImagePlus /></div><h2>登录后开始智能抠图</h2><p>新用户注册即赠 3 次免费处理额度</p><div className="upload-actions"><Link className="button primary" href="/login">登录</Link><Link className="button secondary" href="/register">免费注册</Link></div></section>;

  if (result) return <section className="result-panel">
    <div className="result-preview"><Image src={resultUrl} alt="处理完成的透明背景图片" fill sizes="(max-width: 850px) 100vw, 60vw" unoptimized /></div>
    <div className="result-details"><span className="success-mark"><Check size={18} />处理完成</span><h2>图片已经准备好了</h2><p>{result.width} × {result.height} · {result.mimeType.replace("image/", "").toUpperCase()} · {(result.byteSize / 1024).toFixed(0)} KB</p><a className="button primary download-button" href={`${resultUrl}?download=1`}><Download size={18} />下载高清图片</a><button className="button secondary" onClick={reset}><RotateCcw size={17} />继续处理一张</button><Link className="text-link result-history" href="/app/history">查看全部处理记录</Link></div>
  </section>;

  return <section className="upload-workbench">
    <div className="upload-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy) chooseFile(event.dataTransfer.files[0]); }}>
      {localPreview ? <div className="local-preview"><Image src={localPreview} alt="待处理图片预览" fill sizes="(max-width: 850px) 100vw, 55vw" unoptimized /></div> : <div className="upload-icon">{busy ? <LoaderCircle className="spin" /> : <ImagePlus />}</div>}
      <h2>{file ? file.name : "拖入图片，或点击选择文件"}</h2>
      <p>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "支持 JPG、PNG、WebP、HEIC，单张最大 10MB"}</p>
      <input ref={input} hidden disabled={busy} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={(event) => chooseFile(event.target.files?.[0])} />
      <div className="upload-actions"><button className="button secondary" onClick={() => input.current?.click()} disabled={busy}>{file ? "更换图片" : "选择图片"}</button></div>
    </div>
    <aside className="export-settings">
      <div><h3>导出设置</h3><p>按用途调整成品尺寸和格式</p></div>
      <fieldset><legend>常用尺寸</legend><div className="preset-buttons"><button type="button" className={width === 1000 && height === 1000 ? "selected" : ""} onClick={() => applyPreset(1000)}>电商主图<small>1000 × 1000</small></button><button type="button" className={width === 1080 && height === 1080 ? "selected" : ""} onClick={() => applyPreset(1080)}>社交头像<small>1080 × 1080</small></button></div></fieldset>
      <fieldset><legend>自定义尺寸</legend><div className="size-inputs"><label>宽度<input type="number" min="64" max="6000" value={width} onChange={(e) => setWidth(Math.max(64, Math.min(6000, Number(e.target.value))))} /></label><span>×</span><label>高度<input type="number" min="64" max="6000" value={height} onChange={(e) => setHeight(Math.max(64, Math.min(6000, Number(e.target.value))))} /></label></div></fieldset>
      <fieldset><legend>主体边界</legend><label className="setting-toggle"><input type="checkbox" checked={cropToSubject} onChange={(e) => setCropToSubject(e.target.checked)} /><span><strong>自动裁边</strong><small>宽高作为最大尺寸</small></span></label></fieldset>
      <fieldset disabled={cropToSubject}><legend>填充方式</legend><div className="segmented"><button className={fit === "contain" ? "selected" : ""} onClick={() => setFit("contain")}>完整显示</button><button className={fit === "cover" ? "selected" : ""} onClick={() => setFit("cover")}>铺满裁剪</button></div></fieldset>
      <fieldset><legend>文件格式</legend><div className="segmented three">{(["png", "webp", "jpeg"] as const).map((item) => <button key={item} className={format === item ? "selected" : ""} onClick={() => setFormat(item)}>{item === "jpeg" ? "JPG" : item.toUpperCase()}</button>)}</div></fieldset>
      <fieldset><legend>背景</legend><div className="background-control"><label><input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />透明背景</label><input aria-label="背景颜色" type="color" value={background} disabled={transparent} onChange={(e) => setBackground(e.target.value)} /></div></fieldset>
      <button className="button primary wide" onClick={submit} disabled={busy || !file}>{busy ? <LoaderCircle size={18} className="spin" /> : <Upload size={18} />}{phase === "uploading" ? "正在上传" : phase === "queued" ? "正在排队" : phase === "processing" ? "正在处理" : "移除背景并导出"}</button>
      {message && <p className={`status-message ${phase === "failed" ? "error" : ""}`}>{message}</p>}
    </aside>
  </section>;
}

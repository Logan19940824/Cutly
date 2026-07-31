# Cutly

自动抠图裁剪工具，面向商业化 Web 图片抠图和尺寸修改场景。

## 本地启动

### 完整 Docker 启动

复制环境变量文件，填写阿里云 OSS 和视觉智能配置，然后启动全部服务：

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

Docker 构建默认使用 `https://registry.npmmirror.com` 安装 npm 依赖。需要切换镜像时，在 `.env` 中修改 `NPM_REGISTRY`。

Compose 会启动：

- `postgres`：业务数据库
- `redis`：任务队列与缓存
- `db-init`：同步数据库结构并写入套餐数据，成功后退出
- `web`：Next.js Web/API
- `worker`：阿里云视觉智能 + Sharp 图片处理进程

访问 `http://localhost:3000`。查看状态和日志：

```powershell
docker compose ps
docker compose logs -f web worker
```

### 本机 Node 开发

项目使用 fnm 管理 Node.js，`.node-version` 固定主版本为 24：

```powershell
fnm use
Copy-Item .env.example .env
docker compose up -d postgres redis
npm install
npx prisma db push
npm run db:seed
npm run dev
```

另开终端运行 `npm run worker`。注册用户会获得 3 次测试额度。

## 正式处理所需配置

- 阿里云 OSS 私有 Bucket 和最小权限 RAM 身份
- `ALIYUN_OSS_REGION`、`ALIYUN_OSS_BUCKET` 和 OSS AccessKey
- 阿里云视觉智能 `SegmentCommonImage` 调用权限与对应 RAM AccessKey
- 可访问的 PostgreSQL 和 Redis

当前会员购买按钮保持禁用，直到微信支付或支付宝渠道和商户配置确定。支付成功只能由验签 Webhook 发放会员和额度。

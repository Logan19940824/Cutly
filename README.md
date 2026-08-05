# Cutly

自动抠图裁剪工具，面向商业化 Web 图片抠图和尺寸修改场景。

## Docker 生产部署

默认的 `docker-compose.yml` 使用生产应用镜像，Web 服务以 `NODE_ENV=production` 和 `next start` 运行，不挂载服务器源码。

复制环境变量文件并填写生产配置：

```powershell
Copy-Item .env.example .env
```

在开发机或 CI 构建并推送应用镜像：

```powershell
docker build -t zyl.zlsdy.com:5000/cutly/app:latest .
docker push zyl.zlsdy.com:5000/cutly/app:latest
```

服务器更新并启动生产服务：

```powershell
docker compose pull
docker compose up -d --force-recreate
```

可通过 `.env` 中的 `CUTLY_IMAGE` 使用其他镜像地址或固定版本。服务器不需要安装 npm 依赖，也不会在启动时编译 Next.js。

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

修改代码后需要重新构建并推送应用镜像，再在服务器执行更新命令。

## Docker 开发模式

需要源码挂载和 Next.js 热更新时，先构建开发运行时镜像，再显式使用开发 Compose 文件：

```powershell
docker build -f Dockerfile.dev -t cutly/runtime:node24 .
docker compose -f docker-compose.dev.yml up -d
```

修改 `src` 或 `prisma` 后无需重建镜像；worker 代码修改后执行：

```powershell
docker compose -f docker-compose.dev.yml restart worker
```

### 本机 Node 开发

项目使用 fnm 管理 Node.js，`.node-version` 固定主版本为 24：

```powershell
fnm use
Copy-Item .env.example .env
docker compose -f docker-compose.dev.yml up -d postgres redis
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

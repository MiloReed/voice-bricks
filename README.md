# 声音积木 · Voice Bricks

**你接一句，我接一句，最后让故事开口说话。**

[English](README.en.md) · [在线试玩](https://web-mu-six-82.vercel.app/) · [演示视频](https://x.com/milo_reed/status/2105293980091273331)

![声音积木游戏界面](docs/assets/game-preview.jpg)

声音积木是一个可以和朋友一起玩的故事接龙小游戏。每人接一句，把脑洞拼成故事，再让 AI 念出来。

你可以顺着前面的剧情接，也可以和朋友各写各的，最后揭晓。一个人也能和两位 AI 搭子玩——谁也不知道下一句会把故事带到哪里。

## 怎么玩

1. 选主题和共同音色，创建房间邀请朋友，或进入单人模式。
2. 每人接一句，每句话都会变成一块可以播放的声音积木。
3. 试听、拖动、调整句子，把积木拼成完整故事。
4. 生成完整语音，听听你们编出了什么，再下载海报分享。

多人支持 2–5 人。「顺着接」能看到前面的故事；「一起盲写」把各自的脑洞拼到一起。

## 可以怎么玩

- **和朋友玩**：2–5 人加入同一个房间，一起接龙或各自盲写。
- **一个人玩**：两位 AI 搭子陪你编故事、接梗、加转折。
- **让故事开口**：八种中文音色，每块积木都能试听，拼好后可以完整播放。
- **分享作品**：下载故事海报；多人作品还支持分享链接和竖屏视频导出。
- **手机也能玩**：支持移动端操作，搭配背景音乐和游戏音效。

## 开发说明

游戏目前以中文为主。单人进度保存在当前浏览器会话中；视频导出取决于浏览器兼容性。

## 本地启动

需要 **Node.js 24** 和 npm。

```bash
git clone https://github.com/MiloReed/voice-bricks.git
cd voice-bricks/web
npm ci
cp .env.example .env.local
npm run dev
```

打开 <http://localhost:3000>。不填密钥也能查看界面、听内置样音、进入 `/room/demo` 浏览本地示例；**完整单人 AI 接龙和自定义语音生成需要下面的服务配置**。

### 1. 配置 Supabase

创建自己的 Supabase 项目，在 Authentication 设置中开启 **Anonymous Sign-Ins**。在仓库根目录运行：

```bash
npx supabase login
npx supabase link --workdir backend --project-ref YOUR_PROJECT_REF
npx supabase db push --workdir backend
```

[Supabase CLI 说明](https://supabase.com/docs/reference/cli/supabase-db-push)

这会按顺序应用 `backend/supabase/migrations/` 的 17 个迁移，创建房间、积木、作品、存储权限和共享限流。命令应指向你为本项目创建的数据库；已有数据库应先核对迁移记录。

在 `web/.env.local` 填入项目 URL、publishable key 和 service-role key。多人使用匿名身份与 Realtime；**单人虽然不需要开房，AI 和 TTS 接口仍通过 Supabase 共享限流**，因此不能只填 DeepSeek/VUI 密钥。

也可用 Docker + `npx supabase start --workdir backend` 启动本地 Supabase，使用 CLI 输出的本地 URL、匿名 key 和 service-role key。已开启本地匿名登录，没有种子数据。

### 2. 配置 DeepSeek 与 VUI

| 变量 | 用途 | 是否发送到浏览器 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目地址 | 是 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 公开客户端密钥 | 是 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端存储、权限校验与共享限流 | 否 |
| `DEEPSEEK_API_KEY` | AI 接龙、可选作品锐评 | 否 |
| `DEEPSEEK_MODEL` | 模型名，当前默认 `deepseek-flash` | 否 |
| `VUILABS_API_KEY` | 生成语音 | 否 |
| `VUILABS_API_BASE_URL` | 当前默认为 `https://api.vuilabs.cn` | 否 |

密钥分别从自己的 [DeepSeek](https://platform.deepseek.com/) 与 [VUI](https://vuilabs.cn/) 账户获取；供应商服务需自行开通并承担调用费用。VUI 接口说明见 [API 文档](https://doc.vuilabs.cn/guides/quickstart/)。更改 `.env.local` 后重启开发服务。

## 部署到 Vercel

1. Fork 或导入本仓库，设置 **Root Directory 为 `web`**。
2. 配置上表环境变量；不要把 `.env.local` 上传到 GitHub。
3. 确认目标 Supabase 已应用全部迁移，并开启匿名登录。
4. 在 Supabase Auth 中把自己的正式域名加入 Site URL / Redirect URLs。
5. 部署后体验单人接龙、多人开房、试听、排序、生成和分享。

生成语音与 AI 请求有超时和共享配额保护，限流服务不可用时会拒绝请求。预录样音不产生新的 TTS 调用。不要给服务端密钥添加 `NEXT_PUBLIC_` 前缀。

## 技术栈与目录

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Motion · dnd-kit · Supabase · DeepSeek · VUI · Remotion

```text
web/
  app/                 页面与服务端 API
  features/            房间、接龙、拼装、播放与分享
  lib/                 游戏规则、AI、TTS、音效与 Supabase
  public/audio/        已生成的首页和音色试听样音
  remotion/            多人作品分享视频组件
  tests/               自动化测试
backend/supabase/
  migrations/          17 个顺序执行的数据库迁移
```

## 开发与检查

在 `web/` 中运行：

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

首次类型检查前若还没有 Next.js 生成的页面类型，先运行 `npx next typegen`。GitHub Actions 同样执行测试、Lint、类型检查和构建，不需要真实 API 密钥。

完成服务配置且本地服务启动后，可运行 `node scripts/check-http.mjs http://localhost:3000` 检查参数校验与八种预录样音。`npm run vui:check` 会调用真实 VUI 接口，需配置密钥且会消耗额度。

欢迎提 Issue 或 PR。复现问题时请附浏览器、操作步骤和已隐藏个人信息的截图，不要贴密钥。

## 许可证

原创游戏代码使用 [MIT License](LICENSE)。依赖库保留各自许可证；供应商音色和 API 服务不随本项目开放授权，见 [第三方说明](THIRD_PARTY_NOTICES.md)。

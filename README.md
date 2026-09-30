# 声音积木 · Voice Bricks

**你接一句，我接一句，最后让故事开口说话。**

[English](README.en.md) · [在线试玩](https://web-mu-six-82.vercel.app/) · [演示视频](https://x.com/milo_reed/status/2105293980091273331)

![声音积木游戏界面](docs/assets/game-preview.jpg)

声音积木是一个用 Codex 开发的故事接龙小游戏。每个人写下的一句话都会变成一块可以试听、移动的“声音积木”。把它们拼成一个故事，再选一个声音念出来。

可以叫上朋友一起编，也可以一个人与两位 AI 搭子接龙。它不考知识、不判对错，乐趣在于看下一句会把故事带到哪里。

## 怎么玩

1. 选主题和共同音色，创建房间邀请朋友，或进入单人模式。
2. 轮流接一句故事。单人模式由你和两位 AI 搭子各接两轮，共六块积木。
3. 试听积木、拖动排序，最后还有一次修补句子的机会。
4. 生成完整语音，听听你们编出了什么，再下载海报分享。

多人支持 2–5 人。「顺着接」能看到前面的故事；「一起盲写」把各自的脑洞拼到一起。

## 已有功能

- **单人 AI 接龙**：DeepSeek 读取整段故事，两个搭子分别负责推进剧情、制造转折；失败可重试，进度会保留。
- **多人房间**：房间码、准备状态、轮次与拼装通过 Supabase 实时同步。
- **八种中文音色**：内置试听样音，实际语音通过 VUI 生成。
- **故事拼装**：积木试听、拖拽排序、最终修补、完整朗读。
- **移动端与声音反馈**：手机布局、浏览器合成 BGM 和操作音效；声音由玩家主动开启。
- **作品分享**：1080 × 1350 海报；多人作品支持公开作品页和兼容浏览器中的竖屏视频导出。

当前游戏界面与语音内容以中文为主；英文 README 是开发文档，并不代表游戏已有英文界面。单人作品保存在当前浏览器会话，下载海报可分享；它没有跨设备公开作品页或视频导出。

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

当前游戏调用 VUI 系统音色；没有发布语音模型权重。源码中的 Fish Audio adapter 仅为历史兼容保留，启动当前版本不需要 `FISH_API_KEY`。

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

## 开源范围与许可证

原创游戏代码使用 [MIT License](LICENSE)。依赖库保留各自许可证；供应商音色和 API 服务不随本项目开放授权，见 [第三方说明](THIRD_PARTY_NOTICES.md)。

仓库包含当前声音积木游戏、数据库迁移和必要样音，不包含本地密钥、部署账户信息、用户数据、历史英语模块、内部录屏或演示视频的剪辑工程。

# Voice Bricks · 声音积木

**One sentence each. One shared story. Then hear it out loud.**

[简体中文](README.md) · [Play online](https://web-mu-six-82.vercel.app/) · [Watch the demo](https://x.com/milo_reed/status/2105293980091273331)

![Voice Bricks game interface](docs/assets/game-preview.jpg)

Voice Bricks is a story-relay game for friends. Take turns adding a sentence, piece the story together, and hear AI read it aloud.

Follow the plot, or write separately and reveal everyone’s ideas at the end. Playing solo? Two AI partners will join you. You never know where the next sentence will take the story.

## How to play

1. Choose a theme and voice. Invite friends to a room, or start a solo game.
2. Add a sentence. Each one becomes a voice brick you can play back.
3. Listen, reorder the bricks, and make a final revision to the story.
4. Generate the finished audio, listen to the story, and download a poster to share.

Multiplayer supports 2–5 people: **Classic** lets players read the preceding story; **Chaos** combines sentences written independently.

## Ways to play

- **Play with friends:** 2–5 players share a room, taking turns or writing independently.
- **Play solo:** two AI partners help build the story and add unexpected twists.
- **Hear your story:** choose from eight Chinese voices, preview each brick, and play the finished story.
- **Share what you made:** download a story poster; multiplayer stories also support shareable links and portrait-video export.
- **Play on your phone:** mobile controls, background music and game sounds.

## Development

The game is currently in Chinese. Solo progress is stored in the current browser session. Video export depends on browser compatibility.

## Run locally

Requires **Node.js 24** and npm.

```bash
git clone https://github.com/MiloReed/voice-bricks.git
cd voice-bricks/web
npm ci
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. Without credentials, you can browse the UI, play bundled voice previews and visit `/room/demo` for a local sample. **Full solo AI continuation and custom speech generation require the services below.**

### 1. Set up Supabase

Create your own Supabase project and enable **Anonymous Sign-Ins** under Authentication. From the repository root:

```bash
npx supabase login
npx supabase link --workdir backend --project-ref YOUR_PROJECT_REF
npx supabase db push --workdir backend
```

[Supabase CLI reference](https://supabase.com/docs/reference/cli/supabase-db-push)

The CLI applies all 17 migrations from `backend/supabase/migrations/` in order, setting up rooms, bricks, works, storage permissions and shared API rate limits. Target the database created for this project; review migration history before applying them to an existing database.

Add the project URL, publishable key and service-role key to `web/.env.local`. Multiplayer uses anonymous identities and Realtime. **Solo mode does not create a multiplayer room, but its AI and TTS endpoints still use Supabase for shared rate limiting.** DeepSeek and VUI keys alone are insufficient.

For local Supabase, install Docker and run `npx supabase start --workdir backend`. Use the local URL, anonymous key and service-role key printed by the CLI. The local configuration enables anonymous sign-ins and has no seed data.

### 2. Configure DeepSeek and VUI

| Variable | Purpose | Sent to the browser? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public Supabase client key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side storage, authorization and rate limits | No |
| `DEEPSEEK_API_KEY` | AI story continuation and optional commentary | No |
| `DEEPSEEK_MODEL` | Model name; currently defaults to `deepseek-flash` | No |
| `VUILABS_API_KEY` | Speech generation | No |
| `VUILABS_API_BASE_URL` | Defaults to `https://api.vuilabs.cn` | No |

Get keys from your own [DeepSeek](https://platform.deepseek.com/) and [VUI](https://vuilabs.cn/) accounts. You are responsible for enabling those services and their usage costs. See the [VUI API documentation](https://doc.vuilabs.cn/guides/quickstart/). Restart the development server after changing `.env.local`.

## Deploy to Vercel

1. Fork or import this repository and set **Root Directory to `web`**.
2. Set the environment variables above; never upload `.env.local` to GitHub.
3. Apply every migration to your target Supabase project and enable anonymous sign-ins.
4. Set your deployment domain in Supabase Auth's Site URL / Redirect URLs.
5. Test solo continuation, multiplayer rooms, previews, assembly, generation and sharing.

AI and speech endpoints have timeouts and shared quotas. They reject requests when the rate-limit service is unavailable. Bundled previews do not make new TTS calls. Never prefix server secrets with `NEXT_PUBLIC_`.

## Stack and structure

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Motion · dnd-kit · Supabase · DeepSeek · VUI · Remotion

```text
web/
  app/                 Pages and server-side APIs
  features/            Rooms, gameplay, assembly, playback and sharing
  lib/                 Rules, AI, TTS, audio and Supabase
  public/audio/        Bundled homepage and voice-preview recordings
  remotion/            Multiplayer share-video composition
  tests/               Automated tests
backend/supabase/
  migrations/          17 ordered database migrations
```

## Development checks

From `web/`:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

On a fresh checkout, run `npx next typegen` before the first type check if Next.js route types have not been generated yet. GitHub Actions runs tests, lint, type checking and a build without real provider credentials.

After configuring the services and starting the server, `node scripts/check-http.mjs http://localhost:3000` verifies input validation and the eight bundled previews. `npm run vui:check` calls the real VUI API: it requires a key and consumes quota.

Issues and PRs are welcome. Include your browser and reproduction steps; remove personal data from screenshots and never include keys.

## License

Original game code is released under the [MIT License](LICENSE). Dependencies retain their own licenses. Provider voices and API services are not licensed by this repository; see [third-party notices](THIRD_PARTY_NOTICES.md).

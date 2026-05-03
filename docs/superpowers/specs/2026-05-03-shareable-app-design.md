# Career-Ops Shareable App — Design

**Status:** Brainstorming complete, awaiting user review
**Date:** 2026-05-03
**Author:** Stephen Fang (with Claude)
**Scope:** Distribution and architecture for a downloadable, installable career-ops app that brings its own user, its own data, and its own LLM.

---

## 1. Goals and non-goals

### Goal
Turn career-ops from a single-user repo-clone into something a non-technical job seeker can download as an app, run locally, and use with whichever LLM provider they already pay for (Anthropic, OpenAI, Google, ...). Power users (Claude Code / Gemini CLI / Codex users) should drop in seamlessly and have the app reuse their existing CLI auth.

### Non-goals
- A hosted SaaS. We do not run servers for users; we do not see their CV or their LLM key. Each install is local-first.
- A new pipeline. The existing `.mjs` scripts, `modes/*.md`, `templates/*`, scoring logic, and skill stay as-is. We are wrapping them in a distribution layer, not rewriting them.
- A new product. This is the same career-ops, repackaged. Same evaluations, same reports, same workflows.
- Multi-tenant within a single install. One install = one user. (A user with two laptops just installs twice.)
- Mobile apps. Desktop only.
- Custom finetuned models. We use whichever model the user picks from their chosen provider.

### Success criteria
1. A non-technical user can go from `Career-Ops.dmg` → first evaluation rendered as a PDF in under 10 minutes, with no terminal use.
2. An existing Claude Code user with `claude` already on `$PATH` and logged in to Pro/Max can install the app and start evaluating without entering an API key.
3. The same install supports switching between providers (Anthropic / OpenAI / Google) without reinstall.
4. User data lives entirely in a per-user directory the user can find, edit, back up, and delete. The app code never holds user secrets in plaintext.
5. The CLI still works for power users: `career-ops scan`, `career-ops oferta <url>`, etc., from a terminal, against the same data dir.

---

## 2. Architecture

### High level

```
                    ┌──────────────────────────────────────────────┐
                    │          Career-Ops desktop app              │
                    │             (Tauri shell)                    │
                    │  ┌────────────────────────────────────────┐  │
                    │  │       Webview → localhost:<port>       │  │
                    │  └─────────────────┬──────────────────────┘  │
                    └────────────────────┼─────────────────────────┘
                                         │  http (loopback only)
                                         ▼
                    ┌──────────────────────────────────────────────┐
                    │   Bundled Node sidecar                       │
                    │   ─────────────────                          │
                    │   • Next.js UI (existing web/ app, ported)   │
                    │   • API routes (SSE evaluate, applications)  │
                    │   • lib/agent/runner.ts (pluggable backend)  │
                    │   • lib/data (markdown + sqlite index)       │
                    │   • Pipeline scripts (.mjs) preserved        │
                    └────────────────────┬─────────────────────────┘
                                         │ reads / writes
                                         ▼
                    ┌──────────────────────────────────────────────┐
                    │   Per-user data directory                    │
                    │   (~/Library/Application Support/career-ops, │
                    │    %APPDATA%\career-ops, ~/.local/share/...) │
                    │   ────────────────────────────               │
                    │   cv.md  config/profile.yml                  │
                    │   modes/_profile.md  (user customizations)   │
                    │   data/applications.md  data/pipeline.md     │
                    │   reports/  output/  interview-prep/         │
                    │   .keychain-ref (no secrets in plaintext)    │
                    └──────────────────────────────────────────────┘

        Agent backend is pluggable per-provider:

        ┌── subprocess ──┐    spawns a CLI the user already has
        │                │      e.g. `claude --print --output-format stream-json ...`
        │  selected by   │           `gemini ...`
        │  provider+auth │           `codex ...`
        │                │
        ├── embedded ────┤    AI SDK (or equivalent) calls a provider API
        │                │      • @ai-sdk/anthropic
        │                │      • @ai-sdk/openai
        │                │      • @ai-sdk/google
        │                │    using a key from OS keychain
        └────────────────┘
```

### Why this shape

- **Local-first** because the value of career-ops is private (your CV, your offers, your scoring). Nothing leaves the laptop except the calls to the user's chosen LLM, made with the user's own credentials.
- **Tauri shell** because it gives a real "double-click an app" UX with a small binary, native menus, OS keychain access, auto-update, and code signing — the things that make non-technical users trust an installer.
- **Bundled Node sidecar** because the existing pipeline is Node, the existing web UI is Next.js, and rewriting them in Rust is not the point. The Tauri shell launches Node and points the webview at it.
- **Pluggable agent backend** because "subscription auth via official CLI" and "API key via SDK" are two real-world auth realities and we need both. The interface is identical to consumers; only the runtime differs.
- **Per-user data directory** because the app code is read-only after install but data evolves daily. Separation matches CLAUDE.md's `DATA_CONTRACT.md` (user layer vs. system layer).

---

## 3. Components

### 3.1 Tauri shell

A thin Rust app whose only jobs are:
- Show a webview pointed at `http://127.0.0.1:<dynamic-port>`.
- Spawn the bundled Node sidecar on launch; kill it on quit.
- Expose a small `tauri::command` API for: opening the data dir, reading/writing OS keychain entries, launching system browser for OAuth flows, triggering the auto-updater.
- Native menu bar: File → Open Career-Ops Folder, Window → Reload, Help → Check for Updates, Career-Ops → Preferences.
- `--cli` flag: skip the webview, run the Node sidecar in foreground with the existing CLI surface (`career-ops scan`, `career-ops oferta <url>`, etc.). This is how power users bypass the GUI.

### 3.2 Bundled Node sidecar

The existing `web/` directory, lifted out of the repo and packaged as a Next.js standalone build with the pipeline scripts beside it. Refactors:

- `lib/agent/runner.ts` becomes a thin dispatcher that picks the right backend based on `runner.config` (provider + auth mode).
- `lib/agent/backends/subprocess.ts`: the existing implementation, generalized from "spawn `claude`" to "spawn `${cliBin}` with the right flags." One adapter file per supported CLI (`claude.ts`, `gemini.ts`, `codex.ts`).
- `lib/agent/backends/embedded.ts`: new. Implements the same event stream (`progress`, `tool-use`, `text`, `done`, `error`) using the Vercel AI SDK or equivalent. Tools (filesystem, Playwright, web fetch) are implemented natively in TS.
- `lib/data/paths.ts`: `CAREER_OPS_ROOT` is now the per-user data dir, not a sibling repo. Old env-var override stays for tests and developer mode.

### 3.3 Pipeline scripts

`scan.mjs`, `generate-pdf.mjs`, `generate-latex.mjs`, `merge-tracker.mjs`, etc. ship verbatim inside the app bundle. They run as Node child processes called by the sidecar API routes, against the per-user data dir.

### 3.4 Per-user data directory

OS-standard per-user app-data location. Identical layout to today's repo, minus the system files:

```
career-ops/
├── cv.md
├── article-digest.md
├── config/
│   └── profile.yml
├── modes/
│   └── _profile.md          (user customizations only;
│                             system modes ship in the app bundle)
├── data/
│   ├── applications.md
│   ├── pipeline.md
│   ├── scan-history.tsv
│   └── follow-ups.md
├── reports/
│   └── ###-{slug}-{date}.md
├── output/
│   └── pdfs, latex, etc.
├── interview-prep/
└── jds/
```

System files (`modes/_shared.md`, `modes/oferta.md`, ..., `templates/*`, `*.mjs` scripts) live inside the app bundle and are read-only. The split mirrors the existing `DATA_CONTRACT.md`. Updating the app updates system files; user data is untouched.

### 3.5 Secrets

LLM API keys go in the OS-native secret store via Tauri's keychain plugin:
- macOS: Keychain
- Windows: Credential Manager
- Linux: Secret Service (libsecret)

The data dir contains a small `.keychain-ref` file mapping provider → keychain entry name; no secret material is ever written to disk in plaintext. CLI subprocess auth is owned by the CLI itself (e.g., `claude`'s own `~/.config/claude/` config); we never read or copy it.

---

## 4. Agent backend interface

The single contract every backend implements:

```ts
type Provider = 'anthropic' | 'openai' | 'google';
type AuthMode = 'subprocess' | 'embedded';

interface AgentBackend {
  // Stream of events for the live UI; identical shape across backends
  run(input: AgentRunInput): AsyncIterable<AgentEvent>;
}

interface AgentRunInput {
  modeFile: string;         // path inside app bundle, e.g. 'modes/oferta.md'
  args: Record<string, unknown>;
  cwd: string;              // per-user data dir
  signal: AbortSignal;
}

type AgentEvent =
  | { type: 'progress'; phase: string; message: string }
  | { type: 'tool-use'; tool: string; input: unknown }
  | { type: 'tool-result'; tool: string; output: unknown; ok: boolean }
  | { type: 'text'; chunk: string }
  | { type: 'usage'; inputTokens: number; outputTokens: number; costUSD?: number }
  | { type: 'done'; reportPath?: string }
  | { type: 'error'; message: string; recoverable: boolean };
```

Both backends emit the same events. The UI's `EvaluateLiveStream` component never knows which backend produced them.

### Subprocess backend

For each CLI, an adapter that knows how to:
- Find the binary (`$PATH` lookup with provider-specific candidates, e.g., `claude`, `claude.exe`, app-bundled fallback).
- Build the argv for a "headless run with stream-json output."
- Parse the CLI's stdout into our `AgentEvent` shape (the existing `parseClaudeProgress` pattern, generalized).
- Detect "needs login" and surface it as a recoverable error.

Adapters live in `lib/agent/backends/subprocess/{claude,gemini,codex}.ts`. The current `web/lib/agent/runner.ts` becomes the `claude.ts` adapter almost verbatim.

### Embedded backend

A single file that uses the Vercel AI SDK's `streamText` + tool-calling loop:
- Reads the mode markdown as a prompt template.
- Provides tools: `readFile`, `writeFile`, `listDirectory`, `runScript`, `fetchURL`, `playwrightNavigate`, `playwrightSnapshot`. Each tool is a TS function called via the SDK's tool-call protocol.
- Streams provider responses, parses tool calls, executes them, feeds results back. Loop until `stopReason === 'end_turn'` or budget exceeded.
- Per-provider model picker: Anthropic → `claude-opus-4-7` or `claude-sonnet-4-6` (selectable); OpenAI → `gpt-5` family; Google → `gemini-3.5-pro`. Defaults configurable in `config/profile.yml`.

This backend is the larger build effort. Tools are the long pole.

---

## 5. First-run UX

A small wizard in the webview, three screens:

1. **Pick your LLM provider.** Cards for Anthropic, OpenAI, Google. "Add another later" available from settings. Each card explains: rough cost per evaluation, link to provider docs, and what you'll need (API key or subscription).
2. **Authenticate.** For the chosen provider, the screen offers two options:
   - *I have a subscription* — if the corresponding CLI is already installed and logged in, we detect it and confirm with one click. If not, we offer one-click install of the CLI as a sidecar (Anthropic only at v1; expand to others as their subscription-auth stories solidify).
   - *I have an API key* — paste box, keychain storage. Show a "test connection" button.
3. **Onboarding.** Mirrors the existing CLAUDE.md onboarding flow:
   - Import CV: paste / file upload / "tell me about your experience" → writes `cv.md`.
   - Profile basics: name, email, location, target roles, salary range → writes `config/profile.yml`.
   - Optional: portals customization, archetypes, narrative.
   The onboarding step uses the agent backend itself (it's an LLM-driven wizard) so the user immediately sees their chosen provider working.

After onboarding the user lands on the pipeline view.

---

## 6. LLM-agnosticism in `modes/*.md`

Audit the existing modes for Claude-Code-specific assumptions and abstract them. Examples:

- "Use the Skill tool to ..." → "Use the available tools to ..."
- "Run Playwright MCP `browser_navigate`" → "Open the URL in a real browser and read the rendered DOM" (the embedded backend exposes `playwrightNavigate` as a tool; the subprocess backend already has Playwright via Claude Code MCP).
- "Use TodoWrite ..." → drop or replace with prose ("track progress in your response").

The audit produces a short patch series across `modes/*.md` plus a regression suite. The `.claude/`, `.gemini/`, `.opencode/` mirrors continue to exist for users who run the CLIs directly from a terminal; they may add provider-specific hints back as needed.

This work is bounded — the modes are mostly natural-language prompts already.

---

## 7. Cost transparency

Non-technical users entering an API key need to see what they're spending. The UI shows:

- **Per-run estimate** before starting (rough token count × current model price).
- **Per-run actual** in the live stream (tokens used, USD cost) emitted by the `usage` event.
- **Daily / monthly tally** in the top bar, drawn from `data/usage-log.tsv`.
- **Hard cap** (configurable in profile, default $5/run, $50/month). If exceeded, evaluations pause until the user raises the cap.

Pricing tables live in `lib/agent/pricing.ts`, updated alongside provider releases. (Stale prices show with a "verify against provider" warning.)

---

## 8. Sharing / distribution

- **Public OSS repo** (already exists). License unchanged (currently MIT-style; verify in `LICENSE`).
- **GitHub Releases** hosts signed installers per OS, per version. The Tauri auto-updater points at the Releases feed.
- **Code signing**: Apple Developer ID for `.dmg`; Authenticode for `.exe`. Linux unsigned (`.AppImage` + `.deb`). Funded out of pocket; ~$99/year for Apple, one-time for Authenticode.
- **No App Store / Microsoft Store** at v1. Direct download only.
- **Homebrew tap and `winget` package** for power users in v0.4+.
- **No telemetry by default.** Optional opt-in error reporting via Sentry (or similar) in settings.
- **Privacy posture**: a one-page privacy doc shipped in-app and on the website. "We never see your data. Your LLM provider sees prompts and CV content. That's it."

---

## 9. Error handling

Three classes of errors, each with a clear UX surface:

1. **Provider auth errors** — surfaced as a recoverable error in the live stream with a "Re-authenticate" button that opens the relevant flow (CLI login or paste-new-key).
2. **Tool execution errors** — emitted as `tool-result { ok: false }` events; the model gets the error and decides to retry or give up. UI shows the failed tool in the live stream timeline.
3. **Unexpected crashes** — Tauri shell catches sidecar exits and shows a "career-ops crashed" dialog with a "Copy error to clipboard" button. Sidecar logs ring-buffered to `~/.../career-ops/logs/`.

The existing `verify-pipeline.mjs` and `doctor.mjs` scripts get an in-app surface as **Settings → Health Check**.

---

## 10. Testing strategy

- **Unit tests** (`vitest`) for the new `lib/agent` interface, backend adapters, and provider price/model tables.
- **Integration tests**: `playwright` against the Next.js sidecar with a fake-LLM backend that returns canned `AgentEvent` streams. Covers UI flows end-to-end without real LLM calls.
- **Provider smoke tests**: nightly CI job that runs one canonical evaluation against each provider with a tiny fixture CV + JD. Skipped if provider keys aren't available.
- **Tauri shell tests**: minimal — start the app, verify webview loads, verify sidecar starts and stops cleanly, verify keychain plugin reads/writes.
- **Existing `test-all.mjs`** keeps running against the data layer.

---

## 11. Phased delivery

Each phase is a shippable artifact.

- **v0.1 — Repackage.** Tauri shell + existing `web/` sidecar + subprocess Claude Code adapter only. Mac `.dmg` only. Audience: existing Claude Code users. Acceptance: a Claude Code user with `claude` on `$PATH` can install, point at a data dir, and evaluate offers exactly as today.
- **v0.2 — Per-user data dir + onboarding wizard.** Move from "point at a repo" to "first-run wizard creates `~/Library/Application Support/career-ops`." Acceptance: a fresh Mac user with Claude Code installed can go from download to first eval without git or terminal.
- **v0.3 — Embedded backend (Anthropic).** API-key path, AI SDK, native tool implementations. Acceptance: a Mac user without Claude Code installed can paste an API key and run an evaluation.
- **v0.4 — OpenAI provider.** Both subprocess (Codex if subscription auth is feasible) and embedded (API key) backends. Cost transparency UI. Acceptance: same flows work end-to-end against OpenAI.
- **v0.5 — Google provider.** Same shape.
- **v0.6 — Windows + Linux installers + auto-update.** Code signing, Homebrew tap, `winget` package.
- **v1.0 — Polish.** Onboarding wizard quality pass, provider-switching UX, settings depth, in-app docs, public launch.

We can ship v0.1 to a small alpha (you, me, a few testers) within a couple of weeks of starting; v1.0 is months out depending on how much polish the embedded backend and tool implementations need.

---

## 12. Open questions

These are decisions to make before or during implementation; I don't think any of them block writing the plan, but flagging them:

1. **CLI bundling.** For v0.2, do we ship `claude` as a sidecar binary inside the Tauri bundle, or do we detect and offer a one-click installer that fetches it from npm? Bundling is simpler at first launch but couples our release to Anthropic's CLI release cadence.
2. **Codex subscription auth.** Need to verify whether OpenAI's Codex CLI exposes ChatGPT-Plus OAuth in a way we can detect and reuse. If not, OpenAI is API-key-only at v0.4.
3. **Migration from existing repo.** A user who already runs career-ops from a git clone needs an "import" path: point the app at their existing repo, copy data dir over. Should this be in v0.2 or deferred to v1.0?
4. **Mode file source of truth.** The system `modes/*.md` ship inside the bundle. If the user wants to override one (not just `_profile.md`), how? Options: (a) any `modes/*.md` in the user data dir overrides the bundled one; (b) only `_profile.md` is overridable, others require a fork. Recommend (a) for power-user friendliness.
5. **Update collisions.** When the app auto-updates and a system mode file changes, the user's `_profile.md` is fine, but a user who edited `_shared.md` directly (against CLAUDE.md guidance) loses changes. Acceptable, with a clear warning.
6. **Localization.** The existing `modes/de/`, `modes/fr/`, `modes/ja/` should ship inside the bundle from v0.1. Provider-language pairing UX (auto-detect JD language and pick mode dir) is a v0.5+ enhancement.
7. **Pricing of distribution.** Apple Developer ID ($99/yr) and Authenticode certificate are real recurring costs. Funding model: out-of-pocket, donations link, or optional paid tier? Doesn't block v0.1 (Linux/macOS unsigned) but blocks Mac App Store-quality distribution.

---

## 13. Out of scope (deliberately)

- Replacing `cv.md` with a structured data model.
- A built-in CV editor.
- A scheduling layer beyond the existing `loop` / `schedule` skills.
- Importing offers from email or calendar.
- Posting to LinkedIn / portals on the user's behalf.
- Any kind of recruiter-facing surface.
- Multi-user collaboration.
- Mobile.

These can be revisited post-v1.0.

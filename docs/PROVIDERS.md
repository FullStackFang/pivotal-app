# Providers and CLIs

Career-ops is designed to run on top of an AI coding CLI that has agentic
tool-use, file I/O, and a local browser-automation capability. The shared
prompt library at `modes/*.md` is the source of truth across providers; each
CLI has thin wrappers in its own format.

## Supported

| CLI / runtime    | Status      | Auth               | Install path                                    |
|------------------|-------------|--------------------|-------------------------------------------------|
| **Claude Code**  | ✅ primary  | Pro/Max sub or API | `claude plugin marketplace add santifer/career-ops` then `claude plugin install career-ops` |
| **Gemini CLI**   | ✅ supported | API key (Studio) or paid | `gemini extension install santifer/career-ops` |
| **OpenCode**     | ✅ supported | varies by backend  | clone the repo; `.opencode/commands/` is auto-detected |
| Direct npx       | ✅ companion | inherits from `claude` subprocess | `npx career-ops serve` (local web UI)         |

The Claude Code plugin is the recommended install path because:
- Subscription auth comes for free (no API key entry).
- The `Skill` invocation pattern matches how the rest of the system was authored.
- All 15 slash commands and the auto-pipeline detection are first-class.

## Not supported (and why)

| CLI / product       | Reason                                                                 | Future possibility              |
|---------------------|------------------------------------------------------------------------|---------------------------------|
| **ChatGPT (consumer)** | Cannot run local code, cannot read user's filesystem, cannot spawn Playwright. The product runs entirely on OpenAI's servers. | Would require a separate hosted SaaS variant (channel F in the design doc). Different threat model, different product. |
| **Codex CLI**       | Plugin/skill support is limited compared to Claude Code's; would require parallel maintenance. | Add when there's user demand.   |
| **Cursor**          | MCP support is editor-scoped, not CLI-scoped; career-ops is a CLI tool. | Could ship a `.cursor/rules/` pointer to AGENTS.md if useful. |
| **GitHub Copilot CLI** | No agent skill format equivalent today.                              | Reassess as the CLI matures.    |

## "Use my Claude Code subscription" semantics

A Claude Code subscription is bound to a local `claude` install — auth lives
in the user's home directory, and API calls happen from the machine that runs
`claude`. This means the subscription is reachable in:

- The Claude Code plugin (this repo, when installed via `claude plugin install`).
- The local web UI (`npx career-ops serve`), which spawns `claude` as a subprocess.
- A future desktop-app shell (Tauri) that wraps either of the above.
- A future hosted webapp + local bridge architecture (Channel E in the design
  doc), where a small bridge on the user's machine relays requests from a
  hosted UI.

A Claude Code subscription is **not** reachable from:
- A pure cloud SaaS (no access to the user's `~/.config/claude/` auth state).
- A consumer ChatGPT or Gemini chat session (different runtimes entirely).

## Architecture pointers

- The shared prompt library lives at `modes/*.md` (and language variants under
  `modes/de/`, `modes/fr/`, `modes/ja/`, etc.).
- The Claude Code plugin manifest is at `.claude-plugin/plugin.json`.
- The Gemini CLI extension manifest is at `gemini-extension.json`.
- The OpenCode commands are at `.opencode/commands/*.md`.
- The Gemini CLI commands are at `.gemini/commands/*.toml`.
- The web UI is at `web/` and is launched via `bin/career-ops.mjs serve`.
- Drift between Gemini CLI and OpenCode command sets is checked in CI by
  `verify-commands.mjs`.

## Adding a new CLI

To add support for another CLI:

1. Create a thin command/skill file in that CLI's format under the appropriate
   directory (e.g., `.codex/`, `.cursor/`).
2. Reference `modes/*.md` for the actual evaluation logic — never duplicate
   prompts.
3. Update `verify-commands.mjs` if drift checking should extend to the new
   CLI.
4. Add a row to the support table above with the install path.
5. If the CLI uses an MCP-compatible runtime, the same Node `.mjs` scripts can
   also be exposed as MCP tools — see the deferred MCP work in the design
   doc.

The hard rule: prompts (`modes/*.md`) are universal. CLI plugin formats are
not. Don't try to invent a universal manifest format that targets every CLI;
it doesn't exist, and the drift will eat you.

# Career-Ops for Gemini CLI

Read `CLAUDE.md` for all project instructions, routing, data contract, onboarding, and behavioral rules. They apply equally to Gemini CLI.

Gemini-specific notes:
- Slash commands are defined in `.gemini/commands/*.toml`. CLAUDE.md has the full command table (`### Gemini CLI Commands`).
- `gemini-eval.mjs` is a standalone Gemini API evaluator that does not require the Gemini CLI; useful for batch evaluation runs.
- All evaluation logic lives in `modes/*.md`, shared with Claude Code and OpenCode.

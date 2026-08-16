# dsh-session-attention

`dsh-session-attention` adds a global attention center to the DeepSeek Harness Web UI. It keeps completed or blocked background sessions visible while you work in another conversation and opens the selected session with one click.

## What it shows

- Sessions waiting for an answer, plan review, or approval.
- Sessions that completed while they were not selected.
- Pending interactions before completions, then the most recently updated session.
- At most eight rows at once, with an omitted-session count for larger lists.

The pill disappears when no other session needs attention. On narrow screens the panel uses the available width; keyboard users can close it with Escape and return focus to its trigger.

## Install

The plugin requires DSH `0.1.0-rc.6` and the `web` profile. Clone and install the checkout locally:

```sh
git clone https://github.com/txy-ucas/dsh-session-attention.git
cd dsh-session-attention
dsh plugin --profile web add .
dsh web
```

After the repository is published to npm, install by package name:

```sh
dsh plugin --profile web add dsh-session-attention
```

Confirm composition when troubleshooting:

```sh
dsh --profile web --dump-config
```

The output must contain the `session-attention` row. Remove the plugin with:

```sh
dsh plugin --profile web remove dsh-session-attention
```

## Architecture

The package is both a DSH bundle and a dual-face Cordis plugin. Its Host `apply()` is intentionally empty; the active Loader row lets the DSH client module registry discover `exports["./client"]`. The browser entry declares `sessions`, `slots`, and `locale`, then contributes one entry to the layout-owned `shell.overlay` list through `ctx.slots.inject()`.

All registrations are Cordis effects. Unloading the plugin removes its pending slot injection, active component, localized dictionaries, and bundled style tag. The component receives session state through the framework-provided `useSessions` hook and receives navigation as a plain callback closed over `ctx.sessions.open()`. It never reads Cordis context directly.

The browser artifact uses DSH's closure handoff:

```js
window.__ModuleLoader__.load({ id: 'dsh-session-attention', factory })
```

The package carries its own minimal tsdown configuration because the DSH client bundle preset is not currently exported as a public build package.

## Privacy and reliability

- No network requests, filesystem reads, timers, workers, or Host RPCs are added.
- No content is sent to a model and no session events are created.
- The UI derives only from DSH's bounded `SessionListState` projection.
- Session titles remain inside the existing browser UI.
- Navigation failures produce localized UI copy without exposing stack traces.
- The rendered list is bounded even when a deployment has many sessions.

## Development

Requires Node `^22.19.0 || >=24.0.0` and pnpm `11.7.0`.

```sh
pnpm install
pnpm run check
pnpm run test:install
```

`pnpm run test:install` packs the repository, installs it into an isolated official DSH Web profile, starts the real server, checks the boot manifest, and fetches the served client bundle.

## Compatibility

The peer dependencies intentionally pin the DSH GUI package family to `0.1.0-rc.6`. Client slot and module-loader APIs are pre-release interfaces; an unsupported DSH release fails dependency resolution rather than silently loading an incompatible GUI plugin. The scheduled compatibility workflow reports when a new DSH release needs a plugin update.

## Model Experience

None. This plugin renders existing browser-side session projections and never changes a model request.

### KV Cache effect

None. The plugin does not alter prompts, messages, tools, or provider requests.

## Known limitations

- Completion reminders use DSH's existing process-local viewed state; the plugin does not synchronize a separate read marker between browser tabs.
- Desktop system notifications are intentionally excluded because permission handling and duplicate-tab delivery require a separate product policy.
- The panel opens sessions but does not answer pending interactions itself; the owning DSH conversation UI presents the approval, question, or plan review.

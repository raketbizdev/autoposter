# Autoposter

A local Facebook post scheduler. You write and schedule posts in a React dashboard. At post time, a local
worker runs **Claude Code on your Claude subscription** with the **Claude in Chrome** extension, and Claude
publishes the post on facebook.com in your signed-in Chrome, the way you would by hand.

- No Anthropic API, API keys or token billing. The worker removes `ANTHROPIC_API_KEY` and similar variables
  from Claude's environment and never uses `--bare`, which would bypass the subscription login.
- No Graph API, Meta API or MCP publishing server. Chrome is the only tool Claude gets.

```
Dashboard (React) → Express API → SQLite → worker (every 60s) → claude -p --chrome → Chrome → facebook.com
```

## Requirements

- macOS, Node 24+, Claude Code logged in with your Claude subscription (`claude auth status` shows `"authMethod": "claude.ai"`)
- Chrome with the Claude in Chrome extension connected, signed in to Facebook
- At post time: the Mac is **on, logged in and awake**, and Chrome is **open**

## Use it

```bash
npm install
npm run build                       # build the dashboard
npm start                           # dashboard at http://127.0.0.1:4317
bash scripts/install-launchd.sh     # run server + worker now and at every login; launchd restarts them if they die
```

Without launchd you can run them yourself with `npm start` and `npm run worker`. To remove launchd: `bash scripts/uninstall-launchd.sh`.

1. **Settings:** if more than one Chrome is connected to Claude, set **Facebook account** to the address
   `facebook.com/me` lands on, so only that account posts. Edit how Claude describes you when a group asks
   membership questions.
2. **Destinations:** add your profile (`https://www.facebook.com/me` works), Pages you can post as, and groups you can post in.
3. **Compose:** write text, attach photos or one video, tick destinations, pick a time.
4. **Queue:** watch each post's status and read Claude's report for any run.

## Statuses

| Status | Meaning |
|---|---|
| Queued | Waiting for its time, the group gap or the daily cap |
| Posting… | Claude is working in Chrome |
| Posted | Claude clicked Post and then saw the post live on the profile, Page or group. If it can't see it live, the post goes to "Needs check" instead. |
| Pending approval | Posted to a group that needs admin approval |
| Failed | Claude stopped **before** clicking Post (login wall, checkpoint, no permission). Retried once automatically. |
| Needs check | Claude may have clicked Post but the result is unclear (crash, timeout, unreadable report). **Never retried automatically.** Check Facebook, then choose "It posted" or "It didn't post — retry now". |

## Limits and risks

- **Facebook's terms restrict automated access.** Posting the same content to many groups looks like spam.
  The daily cap (default 10) and group gap (default 20 min) reduce the risk but don't remove it.
- **Subscription usage.** Each post is a full Claude Code browser session. The first test used about
  25 steps and roughly 730k tokens (mostly cached) on Sonnet, in about 2.5 minutes. That counts against your
  plan's usage limits. When a limit is hit, the worker pauses for 1 hour and requeues the post.
- **Check the terms yourself.** Make sure that running Claude Code unattended on a schedule is allowed by
  your current Claude subscription terms.
- **Media is capped at 10 MB per post** (a limit of the Chrome extension's file upload), so most phone videos won't fit.
- If the Mac sleeps, Chrome is closed or Facebook logs you out, posts run late or fail and the dashboard shows it.
  CAPTCHAs and security checks are never bypassed; the post fails and you handle it.
- One Facebook login (the one in Chrome). Pages are posted to by switching into the Page.

## Development

```bash
npm test        # node:test, uses a fake claude binary — no Facebook, no usage
npm run dev     # Vite dev server on :5173, proxying to npm start on :4317
```

Data lives in `data/` (SQLite), `media/` (uploads), `jobs/` (per-run copies) and `logs/` (raw Claude output per run).

## License

[MIT](LICENSE). Not affiliated with, endorsed by or sponsored by Meta or Anthropic. You are responsible for
following Facebook's terms and your Claude plan's terms when you use it.

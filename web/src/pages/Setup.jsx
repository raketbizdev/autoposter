import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Link, Stack, Typography } from '@mui/material';
import { CircleCheck, Globe, Circle, PlugZap, Download, ExternalLink, LogIn, Play, RefreshCw, SquareTerminal } from 'lucide-react';
import { api } from '../api.js';
import { Panel, WorkerControl } from '../components.jsx';

const CHROME_EXTENSION_URL = 'https://claude.ai/chrome';

const PLAN_LABEL = { pro: 'Pro', max: 'Max', team: 'Team', enterprise: 'Enterprise', free: 'Free' };

// Logged in with a Claude subscription (not an API key) on a plan that includes Claude Code.
export function claudeReady(s) {
  return Boolean(s?.claude_installed && s.logged_in && s.subscription && s.paid_plan !== false);
}

export function setupReady(s) {
  return claudeReady(s) && Boolean(s.chrome_extension?.length);
}

function Step({ n, done, title, children }) {
  return (
    <Stack direction="row" spacing={2} sx={{ py: 2.25, borderTop: n > 1 ? 1 : 0, borderColor: 'divider' }}>
      <Box sx={{ pt: 0.25, color: done ? 'success.main' : 'text.disabled', flex: 'none' }}>
        {done ? <CircleCheck size={22} /> : <Circle size={22} />}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography fontWeight={700}>{n}. {title}</Typography>
        <Box sx={{ mt: 0.75, color: 'text.secondary', fontSize: 14 }}>{children}</Box>
      </Box>
    </Stack>
  );
}

export default function Setup({ status, onStatusChange, go, onSetupChange }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [checking, setChecking] = useState(false);
  const [chromeTest, setChromeTest] = useState(null); // null | 'running' | { ok, browsers, error }
  async function testChrome() {
    setChromeTest('running');
    try { setChromeTest(await api.testChrome()); } catch (e) { setChromeTest({ ok: false, error: e.message }); }
  }

  const check = useCallback(async () => {
    setChecking(true);
    setError('');
    try { const next = await api.setup(); setS(next); onSetupChange?.(next); } catch (e) { setError(e.message); } finally { setChecking(false); }
  }, [onSetupChange]);
  useEffect(() => { check(); }, [check]);

  // While a terminal step is open, keep checking so the ticks turn green on their own.
  useEffect(() => {
    if (!note) return undefined;
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [note, check]);

  async function run(action, message) {
    setError('');
    try { await action(); setNote(message); } catch (e) { setError(e.message); }
  }

  if (!s) return error ? <Alert severity="error">{error}</Alert> : null;
  const win = s.platform === 'win32';
  const terminal = win ? 'PowerShell' : 'Terminal';

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 820 }}>
      {setupReady(s)
        ? <Alert severity="success">Claude Code is ready on your Claude subscription. Finish the Chrome step if you haven't, then you're set.</Alert>
        : <Alert severity="info">Autoposter uses Claude Code with your own Claude subscription (Pro or Max). No API key. This takes about 5 minutes, once.</Alert>}
      {note && <Alert severity="info" onClose={() => setNote('')}>{note}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      <Panel title="Get ready" action={
        <Button size="small" color="secondary" startIcon={<RefreshCw size={15} className={checking ? 'spin' : undefined} />} onClick={check} disabled={checking}>
          Check again
        </Button>
      }>
        <Step n={1} done={s.claude_installed} title="Install Claude Code">
          {s.claude_installed ? (
            <>Found at <Box component="code" sx={{ fontSize: 12, wordBreak: 'break-all' }}>{s.claude_path}</Box></>
          ) : (
            <>
              <Typography fontSize={14} mb={1.25}>
                This opens {terminal} and runs Anthropic's official installer. When it says it's done, come back here.
              </Typography>
              <Button variant="contained" startIcon={<Download size={16} />}
                onClick={() => run(api.installClaude, `Installing Claude Code in ${terminal}. This page updates when it's done.`)}>
                Install Claude Code
              </Button>
            </>
          )}
        </Step>

        <Step n={2} done={claudeReady(s)} title="Log in with your Claude subscription">
          {claudeReady(s) && (
            <>Logged in{s.email ? ` as ${s.email}` : ''} on Claude {PLAN_LABEL[s.plan] || 'subscription'}{s.plan ? '' : ' (plan not reported by this Claude Code version)'}.</>
          )}
          {s.logged_in && !s.subscription && (
            <Alert severity="warning" sx={{ mb: 1.25 }}>
              Claude Code is logged in with {s.auth_method || 'an API key'}, which bills API usage. Log in again and choose your Claude account.
            </Alert>
          )}
          {s.logged_in && s.subscription && s.paid_plan === false && (
            <Alert severity="warning" sx={{ mb: 1.25 }}
              action={<Button color="inherit" size="small" href="https://claude.ai/upgrade" target="_blank" rel="noreferrer">Upgrade</Button>}>
              Your Claude account is on the {PLAN_LABEL[s.plan] || s.plan} plan. Claude Code with Chrome needs Claude Pro or Max.
              Upgrade, then click Check again.
            </Alert>
          )}
          {!(s.logged_in && s.subscription) && (
            <>
              <Typography fontSize={14} mb={1.25}>
                Opens {terminal} and your browser. Sign in with the Claude account that has your Pro or Max plan.
              </Typography>
              <Button variant="contained" startIcon={<LogIn size={16} />} disabled={!s.claude_installed}
                onClick={() => run(api.loginClaude, 'Finish signing in in your browser. This page updates when you are logged in.')}>
                Log in
              </Button>
            </>
          )}
        </Step>

        <Step n={3} done={Boolean(s.chrome_extension?.length) && chromeTest?.ok === true}
          title="Install Claude in Chrome and connect it">
          {s.chrome_extension?.length ? (
            <Typography fontSize={14} mb={1.25}>
              <strong>Installed</strong> in {s.chrome_extension.map((e) => `${e.browser} (${e.profile})`).join(', ')}.
              Sign in to the extension with the same Claude account, keep that Chrome open when posts are due, and log it in to
              every account you'll post to.
            </Typography>
          ) : (
            <>
              <Alert severity="warning" sx={{ mb: 1.25 }}>
                The Claude in Chrome extension isn't installed in Chrome on this computer yet.
              </Alert>
              <Typography fontSize={14} mb={1.25}>
                Install it, sign in to it with the same Claude account, then click Check again.
              </Typography>
            </>
          )}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {!s.chrome_extension?.length && (
              <Button variant="contained" startIcon={<Globe size={16} />} endIcon={<ExternalLink size={14} />}
                href={CHROME_EXTENSION_URL} target="_blank" rel="noreferrer">
                Get Claude in Chrome
              </Button>
            )}
            <Button variant={s.chrome_extension?.length ? 'contained' : 'outlined'} color={s.chrome_extension?.length ? 'primary' : 'secondary'}
              startIcon={<PlugZap size={16} />} disabled={!claudeReady(s) || chromeTest === 'running'} onClick={testChrome}>
              {chromeTest === 'running' ? 'Testing… (up to a minute)' : 'Test connection'}
            </Button>
          </Stack>
          {chromeTest && chromeTest !== 'running' && (chromeTest.ok
            ? <Alert severity="success" sx={{ mt: 1.25 }}>Connected: Claude can reach {chromeTest.browsers} Chrome browser{chromeTest.browsers === 1 ? '' : 's'}.</Alert>
            : <Alert severity="error" sx={{ mt: 1.25 }}>
                Claude couldn't reach Chrome{chromeTest.error ? `: ${chromeTest.error}` : '.'} Open Chrome, make sure the extension is
                signed in to your Claude account, then test again.
              </Alert>)}
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            The test asks Claude to list your connected browsers. It takes a few seconds and a tiny bit of your Claude usage.
          </Typography>
        </Step>

        <Step n={4} done={false} title="Send a test post">
          <Typography fontSize={14}>
            In <Link component="button" onClick={() => go('destinations')}>Destinations</Link>, add your profile
            (<code>https://www.facebook.com/me</code>) with the audience <strong>Only me</strong>. Then write a short post
            in <Link component="button" onClick={() => go('compose')}>Compose</Link>, open it in the Queue and press{' '}
            <strong>Post now</strong>. Only you will see it.
          </Typography>
        </Step>

        <Step n={5} done={Boolean(status?.worker_running)} title="Start the worker">
          <Typography fontSize={14} mb={1.25}>
            The worker posts everything at its scheduled time. {s.app
              ? 'It keeps running while Autoposter is in the menu bar or system tray, and starts again when you reopen the app.'
              : 'Keep this computer awake and Chrome open.'}
          </Typography>
          {status && !status.worker_running && <WorkerControl status={status} onChange={onStatusChange} />}
          {status?.worker_running && <Chip color="success" icon={<Play size={14} />} label="Worker running" />}
        </Step>
      </Panel>

      <Typography variant="caption" color="text.secondary">
        <SquareTerminal size={13} style={{ verticalAlign: '-2px' }} /> Each post is a real Claude session in your Chrome and counts toward
        your plan's usage limits. Social networks restrict automation, so keep the daily cap low.
      </Typography>
    </Stack>
  );
}

#!/usr/bin/env node
// Stand-in for the claude CLI. FAKE_MODE picks the canned behaviour.
let input = '';
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => {
  const mode = process.env.FAKE_MODE || 'success';
  const fs = require('node:fs');
  if (process.env.FAKE_RECORD) fs.writeFileSync(process.env.FAKE_RECORD, JSON.stringify({ args: process.argv.slice(2), input, env: Object.keys(process.env) }));
  const block = (o) => 'Done.\n```json\n' + JSON.stringify(o) + '\n```';
  const env = (result, extra = {}) => process.stdout.write(JSON.stringify({ type: 'result', is_error: false, num_turns: 3, duration_ms: 10, result, ...extra }));
  switch (mode) {
    case 'success': env(block({ status: 'submitted', clicked_post: true, post_url: null, note: 'ok' })); break;
    case 'pending': env(block({ status: 'pending_approval', clicked_post: true, post_url: null, note: 'awaiting admin' })); break;
    case 'failed_before': env(block({ status: 'failed', clicked_post: false, post_url: null, note: 'login wall' })); break;
    case 'failed_after': env(block({ status: 'failed', clicked_post: true, post_url: null, note: 'spinner never stopped' })); break;
    case 'garbage': env('I posted it, I think.'); break;
    case 'crash': process.stderr.write('boom'); process.exit(3);
    case 'usage': process.stderr.write('Claude usage limit reached. Your limit will reset at 5pm'); process.exit(1);
    case 'hang': setTimeout(() => {}, 1e9); break;
  }
});

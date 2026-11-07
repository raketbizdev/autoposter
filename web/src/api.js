async function request(method, url, body) {
  const init = { method };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  status: () => request('GET', '/api/status'),
  destinations: () => request('GET', '/api/destinations'),
  addDestination: (d) => request('POST', '/api/destinations', d),
  updateDestination: (id, d) => request('PATCH', `/api/destinations/${id}`, d),
  removeDestination: (id) => request('DELETE', `/api/destinations/${id}`),
  createPost: (form) => request('POST', '/api/posts', form),
  postMedia: (id) => request('GET', `/api/posts/${id}/media`),
  jobs: (status) => request('GET', `/api/jobs${status ? `?status=${status}` : ''}`),
  jobsBetween: (from, to) => request('GET', `/api/jobs?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`),
  jobLog: (id) => request('GET', `/api/jobs/${id}/log`),
  jobAction: (id, action) => request('POST', `/api/jobs/${id}/${action}`),
  removeJob: (id) => request('DELETE', `/api/jobs/${id}`),
  setJobLink: (id, url) => request('POST', `/api/jobs/${id}/link`, { url }),
  startWorker: () => request('POST', '/api/worker/start'),
  stopWorker: () => request('POST', '/api/worker/stop'),
  // Served by the Vite dev server (web/vite.config.js), since a dead API server can't restart itself.
  restartServer: () => request('POST', '/__dev/restart-server'),
  setup: () => request('GET', '/api/setup'),
  installClaude: () => request('POST', '/api/setup/install-claude'),
  loginClaude: () => request('POST', '/api/setup/login'),
  testChrome: () => request('POST', '/api/setup/test-chrome'),
  settings: () => request('GET', '/api/settings'),
  saveSettings: (s) => request('PUT', '/api/settings', s),
};

export const TYPE_LABEL = { profile: 'Profile', page: 'Page', group: 'Group' };
// Mirrors src/platforms.js.
export const PLATFORMS = {
  facebook: { label: 'Facebook', types: ['profile', 'page', 'group'], posting: true, maxImages: 10, example: 'https://www.facebook.com/…' },
  linkedin: { label: 'LinkedIn', types: ['profile', 'page', 'group'], posting: true, maxImages: 10, example: 'https://www.linkedin.com/in/…' },
  x: { label: 'X', types: ['profile'], posting: true, maxImages: 4, example: 'https://x.com/…' },
  threads: { label: 'Threads', types: ['profile'], posting: true, maxImages: 10, example: 'https://www.threads.com/@…' },
  reddit: { label: 'Reddit', types: ['profile', 'group'], typeLabel: { group: 'Subreddit' }, posting: true, maxImages: 10,
    example: 'https://www.reddit.com/r/…', hint: 'The first line of your post becomes the Reddit title.' },
  instagram: { label: 'Instagram', types: ['profile'], posting: true, maxImages: 10, needs: 'media', example: 'https://www.instagram.com/…' },
  tiktok: { label: 'TikTok', types: ['profile'], posting: true, maxImages: 0, needs: 'video', example: 'https://www.tiktok.com/@…' },
};
// Mirrors mediaProblem() in src/platforms.js.
export function mediaProblem(platform, kinds) {
  const pf = PLATFORMS[platform];
  const images = kinds.filter((k) => k === 'image').length;
  const video = kinds.includes('video');
  if (pf.needs === 'video' && !video) return `${pf.label} needs a video`;
  if (pf.needs === 'media' && !images && !video) return `${pf.label} needs a photo or a video`;
  if (images > pf.maxImages) return pf.maxImages ? `${pf.label} takes at most ${pf.maxImages} photos` : `${pf.label} takes a video, not photos`;
  return null;
}
export const typeLabel = (platform, type) => PLATFORMS[platform]?.typeLabel?.[type] ?? TYPE_LABEL[type];
export const AUDIENCE_LABEL = { default: 'Composer default', public: 'Public', friends: 'Friends', only_me: 'Only me' };
export const STATUS_LABEL = {
  queued: 'Queued', running: 'Posting…', submitted: 'Posted', pending_approval: 'Pending approval',
  awaiting_join: 'Waiting to join', failed: 'Failed', cancelled: 'Cancelled', needs_check: 'Needs check',
};

export function formatWhen(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

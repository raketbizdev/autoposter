// Where a destination can live, and what each platform accepts. `needs`: 'media' (a photo or video is required)
// or 'video' (a video is required). `maxImages`: most photos one post can carry.
export const PLATFORMS = {
  facebook: { label: 'Facebook', types: ['profile', 'page', 'group'], hosts: ['facebook.com'], posting: true, maxImages: 10 },
  linkedin: { label: 'LinkedIn', types: ['profile', 'page', 'group'], hosts: ['linkedin.com'], posting: true, maxImages: 10 },
  x: { label: 'X', types: ['profile'], hosts: ['x.com', 'twitter.com'], posting: true, maxImages: 4 },
  threads: { label: 'Threads', types: ['profile'], hosts: ['threads.com', 'threads.net'], posting: true, maxImages: 10 },
  reddit: { label: 'Reddit', types: ['profile', 'group'], hosts: ['reddit.com'], posting: true, maxImages: 10 },
  instagram: { label: 'Instagram', types: ['profile'], hosts: ['instagram.com'], posting: true, maxImages: 10, needs: 'media' },
  tiktok: { label: 'TikTok', types: ['profile'], hosts: ['tiktok.com'], posting: true, maxImages: 0, needs: 'video' },
};

/** Why these attachments can't go to this platform, or null when they can. */
export function mediaProblem(platform, kinds) {
  const pf = PLATFORMS[platform];
  if (!pf) return 'Unknown platform';
  const images = kinds.filter((k) => k === 'image').length;
  const video = kinds.includes('video');
  if (pf.needs === 'video' && !video) return `${pf.label} needs a video`;
  if (pf.needs === 'media' && !images && !video) return `${pf.label} needs a photo or a video`;
  if (images > pf.maxImages) return pf.maxImages ? `${pf.label} takes at most ${pf.maxImages} photos` : `${pf.label} takes a video, not photos`;
  return null;
}

/** Every host a post link may point to. */
export const ALL_HOSTS = Object.values(PLATFORMS).flatMap((p) => p.hosts);

export function isPlatformUrl(platform, value) {
  const hosts = PLATFORMS[platform]?.hosts;
  if (!hosts) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

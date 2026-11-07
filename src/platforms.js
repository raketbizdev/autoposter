// Where a destination can live. Only platforms with posting: true are picked by the worker or accepted when scheduling;
// the rest can be saved on the Destinations page until their posting instructions exist.
export const PLATFORMS = {
  facebook: { label: 'Facebook', types: ['profile', 'page', 'group'], hosts: ['facebook.com'], posting: true },
  reddit: { label: 'Reddit', types: ['profile', 'group'], hosts: ['reddit.com'], posting: false },
  linkedin: { label: 'LinkedIn', types: ['profile', 'page', 'group'], hosts: ['linkedin.com'], posting: false },
  tiktok: { label: 'TikTok', types: ['profile'], hosts: ['tiktok.com'], posting: false },
  x: { label: 'X', types: ['profile'], hosts: ['x.com', 'twitter.com'], posting: false },
  threads: { label: 'Threads', types: ['profile'], hosts: ['threads.com', 'threads.net'], posting: false },
  instagram: { label: 'Instagram', types: ['profile'], hosts: ['instagram.com'], posting: false },
};

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

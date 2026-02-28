const frameImports = import.meta.glob('../../../assets/0x72/frames/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const FRAME_LIST = Object.entries(frameImports).map(([path, url]) => {
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  const key = filename.replace('.png', '');
  return { key, url };
});

export const FRAME_URLS: Record<string, string> = FRAME_LIST.reduce((acc, entry) => {
  acc[entry.key] = entry.url;
  return acc;
}, {} as Record<string, string>);

import { registerAs } from '@nestjs/config';

export function deriveHttpUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('ws://')) return `http://${url.slice('ws://'.length)}`;
  if (url.startsWith('wss://')) return `https://${url.slice('wss://'.length)}`;
  return url;
}

export default registerAs('livekit', () => {
  const url = process.env.LIVEKIT_URL ?? '';
  const httpUrl = process.env.LIVEKIT_HTTP_URL || deriveHttpUrl(url);
  return {
    url,
    httpUrl,
    apiKey: process.env.LIVEKIT_API_KEY ?? '',
    apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
    sfuUrl: process.env.SFU_URL || url || deriveHttpUrl(url),
  };
});

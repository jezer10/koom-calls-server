import {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver,
} from 'livekit-server-sdk';

export interface LiveKitClientBundle {
  url: string;
  apiKey: string;
  apiSecret: string;
  roomService: RoomServiceClient;
  webhookReceiver: WebhookReceiver;
}

export function createLiveKitAccessToken(
  apiKey: string,
  apiSecret: string,
  options: { identity: string; ttlSeconds?: number },
): AccessToken {
  return new AccessToken(apiKey, apiSecret, {
    identity: options.identity,
    ttl: options.ttlSeconds,
  });
}

export function createLiveKitClient(args: {
  url: string;
  apiKey: string;
  apiSecret: string;
}): LiveKitClientBundle {
  const { url, apiKey, apiSecret } = args;
  return {
    url,
    apiKey,
    apiSecret,
    roomService: new RoomServiceClient(url, apiKey, apiSecret),
    webhookReceiver: new WebhookReceiver(apiKey, apiSecret),
  };
}

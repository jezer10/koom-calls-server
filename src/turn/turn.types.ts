export type IceCredentialType = 'password';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: IceCredentialType;
}

export interface TurnCredentials {
  iceServers: IceServer[];
  expiresAt: string;
}

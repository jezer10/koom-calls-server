export interface AuthenticatedUser {
  userId: string;
}

export interface RequestUser {
  user: AuthenticatedUser;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

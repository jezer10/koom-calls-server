export interface AuthenticatedUser {
  userId: string;
  sub?: string;
  email?: string;
  role?: string;
  roles?: string[];
  isAdmin?: boolean;
}

export interface RequestUser {
  user: AuthenticatedUser;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

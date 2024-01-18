/* eslint-disable @typescript-eslint/no-empty-interface */
import type { Request } from 'express';
import type { JwtPayload } from 'jsonwebtoken';
export interface RequestWithUser extends Request {
  auth?: AuthJwtPayload;
}

export interface AuthJwtPayload extends JwtPayload {
  userId: string;
  role?: IRole;
}

type IRole = 'User' | 'Admin' | 'SuperAdmin';

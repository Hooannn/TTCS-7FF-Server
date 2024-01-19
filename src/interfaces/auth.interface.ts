/* eslint-disable @typescript-eslint/no-empty-interface */
import { UserRole } from '@/entity';
import type { Request } from 'express';
import type { JwtPayload } from 'jsonwebtoken';
export interface RequestWithUser extends Request {
  auth?: AuthJwtPayload;
}

export interface AuthJwtPayload extends JwtPayload {
  userId: string;
  role?: UserRole;
}

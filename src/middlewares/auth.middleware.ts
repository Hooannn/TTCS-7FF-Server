import { NextFunction, Response } from 'express';
import { HttpException } from '@exceptions/HttpException';
import { AuthJwtPayload, RequestWithUser } from '@interfaces/auth.interface';
import AuthService from '@/services/auth.service';
import { errorStatus } from '@/config';
const authMiddleware = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const authService = new AuthService();
    const Authorization = req.cookies['Authorization'] || (req.header('Authorization') ? req.header('Authorization').split('Bearer ')[1] : null);
    if (Authorization) {
      const decodedToken = authService.verifyAccessToken(Authorization); // Verify token logic here
      req.auth = decodedToken as AuthJwtPayload;
      next();
    } else {
      next(new HttpException(401, errorStatus.NO_CREDENTIALS));
    }
  } catch (error) {
    next(new HttpException(401, errorStatus.NOT_AUTHORIZED));
  }
};

export default authMiddleware;

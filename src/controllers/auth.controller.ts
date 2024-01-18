import AuthService from '@/services/auth.service';
import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { errorStatus, successStatus } from '@/config';
import { RequestWithUser } from '@/interfaces';
import { HttpException } from '@/exceptions/HttpException';
class AuthController {
  private authService = new AuthService();
  public signUpByEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { firstName, lastName, email, password } = req.body;
      const data = await this.authService.signUpByEmail({ email, password, firstName, lastName });
      res.status(201).json({ code: 201, success: true, data, message: successStatus.SIGN_UP_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };

  public signInByEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { email, password } = req.body;
      const data = await this.authService.signInByEmail({ email, password });
      res.status(200).json({ code: 200, success: true, data, message: successStatus.SIGN_IN_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };

  public getAccessToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      const data = await this.authService.getAccessToken(refreshToken);
      res.status(200).json({ code: 200, success: true, data, message: successStatus.REFRESH_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };

  public forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { email } = req.body;
      const { locale } = req.query;
      const data = await this.authService.forgotPassword(email, locale?.toString());
      res.status(200).json({ code: 200, success: true, data, message: successStatus.FORGOT_PASSWORD_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };

  public resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { password, token } = req.body;
      const data = await this.authService.resetPassword(password, token);
      res.status(200).json({ code: 200, success: true, data, message: successStatus.RESET_PASSWORD_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };

  public getUser = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.auth;
      const data = await this.authService.getUser(userId);
      res.status(200).json({ code: 200, success: true, data, message: 'Success' });
    } catch (error) {
      next(error);
    }
  };

  public deactivateAccount = async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.auth;
      const { password } = req.body;
      const data = await this.authService.deactivateAccount({ userId, password });
      res
        .clearCookie('refresh_token', { path: '/' })
        .clearCookie('access_token', { path: '/' })
        .status(200)
        .json({ code: 200, success: true, data, message: 'Success' });
    } catch (error) {
      next(error);
    }
  };

  public googleAuthentication = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { googleAccessToken } = req.body;
      if (!googleAccessToken) {
        throw new HttpException(400, errorStatus.GOOGLE_AUTHENTICATION_FAILED);
      }
      const data = await this.authService.googleAuthentication(googleAccessToken.toString());
      res.status(200).json({ code: 200, success: true, data, message: data.message || successStatus.GOOGLE_AUTHENTICATION_SUCCESSFULLY });
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;

import jwt, { JwtPayload } from 'jsonwebtoken';
import type { AuthJwtPayload } from '@/interfaces';
import { hashSync, compareSync } from 'bcrypt';
import {
  ACCESS_TOKEN_LIFE,
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_LIFE,
  REFRESH_TOKEN_SECRET,
  SALTED_PASSWORD,
  RESETPASSWORD_TOKEN_LIFE,
  RESETPASSWORD_TOKEN_SECRET,
  CLIENT_URL,
  GG_CLIENT_ID,
  successStatus,
} from '@config';
import { HttpException } from '@/exceptions/HttpException';
import { errorStatus } from '@config';
import NodemailerService from './nodemailer.service';
import OrdersService from './orders.service';
import axios from 'axios';
import { User, UserRole } from '@/entity';
import { AppDataSource } from '@/data-source';
class AuthService {
  private jwt = jwt;
  private User = User;
  private userRepositoy = AppDataSource.getRepository(User);
  private nodemailerService = new NodemailerService();
  private ordersService = new OrdersService();
  public async signUpByEmail({ email, password, firstName, lastName }: { email: string; password: string; firstName: string; lastName: string }) {
    const isEmailExisted = await this.userRepositoy.exists({ where: { email } });
    if (isEmailExisted) throw new HttpException(409, errorStatus.EMAIL_EXISTED);
    const hashedPassword = hashSync(password, parseInt(SALTED_PASSWORD));
    const user = this.userRepositoy.create({
      email,
      password: hashedPassword,
      role: UserRole.User,
      firstName,
      lastName,
    });
    await this.userRepositoy.save(user);
    return { email, password };
  }

  public async signInByEmail({ email, password }: { email: string; password: string }) {
    const target = await this.User.findOne({ email });
    if (!target) throw new HttpException(400, errorStatus.UNREGISTERED);
    const isPasswordMatched = compareSync(password, target.password.toString());
    if (!isPasswordMatched) throw new HttpException(400, errorStatus.WRONG_PASSWORD);
    const refreshToken = this.generateRefreshToken({ userId: target._id.toString() });
    const accessToken = this.generateAccessToken({ userId: target._id.toString(), role: target.role.toString() as AuthJwtPayload['role'] });
    const user = await this.User.findByIdAndUpdate(target._id.toString(), { refreshToken }, { returnOriginal: false }).select('-password');
    return { user, refreshToken, accessToken };
  }

  public async getAccessToken(refreshToken: string) {
    if (!refreshToken) throw new HttpException(401, errorStatus.NO_CREDENTIALS);
    const { userId: refreshUserId } = this.verifyRefreshToken(refreshToken);
    const user = await this.User.findById(refreshUserId);
    if (!user) throw new HttpException(400, errorStatus.INVALID_TOKEN_PAYLOAD);
    const accessToken = this.generateAccessToken({ userId: user._id.toString(), role: user.role });
    return { accessToken };
  }

  public async forgotPassword(email: string, locale: string) {
    const user = await this.User.findOne({ email });
    if (!user) throw new HttpException(400, errorStatus.UNREGISTERED);
    const blackJti = new this.Jti({ isUsed: false });
    await blackJti.save();
    const token = this.generateResetPasswordToken({ email, jti: blackJti._id.toString() });
    const resetPasswordUrl = `${CLIENT_URL}/auth?type=reset&token=${token}`;
    await this.nodemailerService.sendResetPasswordMail(email, user?.firstName, resetPasswordUrl, locale);
    return { token };
  }

  public async resetPassword(newPassword: string, token: string) {
    const decodedToken = this.verifyResetPasswordToken(token) as JwtPayload;
    const jti = await this.Jti.findById(decodedToken?.jti.toString());
    if (jti.isUsed) throw new HttpException(400, errorStatus.RESET_PASSWORD_EXPIRED);
    const newHashedPassword = hashSync(newPassword, parseInt(SALTED_PASSWORD));
    await this.User.findOneAndUpdate({ email: decodedToken.email }, { password: newHashedPassword });
    await jti.update({ isUsed: true });
    return { email: decodedToken.email, password: newPassword };
  }

  public async deactivateAccount({ userId, password }: { userId: string; password: string }) {
    const target = await this.User.findById(userId);
    if (!target) throw new HttpException(400, errorStatus.USER_NOT_FOUND);
    const isPasswordMatched = compareSync(password, target.password?.toString());
    if (!isPasswordMatched) throw new HttpException(400, errorStatus.WRONG_PASSWORD);
    const [orders, reservations] = await Promise.all([
      await this.ordersService.getOrdersByCustomerId({ customerId: userId, userId }),
      await this.reservationsService.getUserReservations({ customerEmail: target.email, sort: null }),
    ]);
    orders.forEach(async order => {
      if (order.status !== 'Done') {
        await order.update({ status: 'Cancelled' });
      }
    });
    reservations.forEach(async order => {
      await order.update({ status: 'Done' });
    });
    const deactiveUser = new this.DeactiveUser(({ ...target } as any)._doc);
    await deactiveUser.save();
    return this.User.findByIdAndDelete(userId);
  }

  public async getUser(id: string) {
    return await this.User.findById(id).select('-password -refreshToken');
  }

  public async googleAuthentication(googleAccessToken: string) {
    const userData = await this.getGoogleUserData(googleAccessToken);
    const { email_verified, family_name, given_name, email, picture } = userData;
    if (!email_verified) throw new HttpException(400, errorStatus.EMAIL_VERIFICATION_FAILED);
    const target = await this.User.findOne({ email });
    if (target) {
      const refreshToken = this.generateRefreshToken({ userId: target._id.toString() });
      const accessToken = this.generateAccessToken({ userId: target._id.toString(), role: target.role.toString() as AuthJwtPayload['role'] });
      const user = await this.User.findByIdAndUpdate(target._id.toString(), { refreshToken }, { returnOriginal: false }).select('-password');
      return { user, refreshToken, accessToken, message: successStatus.GOOGLE_SIGN_IN_SUCCESSFULLY };
    } else {
      const password = email + GG_CLIENT_ID;
      const hashedPassword = hashSync(password, parseInt(SALTED_PASSWORD));
      const user = new this.User({ email, password: hashedPassword, role: 'User', firstName: given_name, lastName: family_name, avatar: picture });
      await user.save();
      const refreshToken = this.generateRefreshToken({ userId: user._id.toString() });
      const accessToken = this.generateAccessToken({ userId: user._id.toString(), role: user.role.toString() as AuthJwtPayload['role'] });
      const userWithTokens = await this.User.findByIdAndUpdate(user._id.toString(), { refreshToken }, { returnOriginal: false }).select('-password');
      return { user: userWithTokens, refreshToken, accessToken, message: successStatus.GOOGLE_SIGN_UP_SUCCESSFULLY };
    }
  }

  public verifyAccessToken(token: string) {
    return this.jwt.verify(token, ACCESS_TOKEN_SECRET);
  }

  private async getGoogleUserData(googleAccessToken: string) {
    try {
      const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
        },
      });
      return data;
    } catch (error) {
      throw new HttpException(400, errorStatus.INVALID_GOOGLE_ACCESS_TOKEN);
    }
  }

  private generateAccessToken({ userId, role }: AuthJwtPayload) {
    return this.jwt.sign({ userId, role }, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_LIFE });
  }

  private generateRefreshToken({ userId }: AuthJwtPayload) {
    return this.jwt.sign({ userId }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_LIFE });
  }

  private verifyRefreshToken(token: string) {
    return this.jwt.verify(token, REFRESH_TOKEN_SECRET) as AuthJwtPayload;
  }

  private generateResetPasswordToken({ email, jti }: { email: string; jti: string }) {
    return this.jwt.sign({ email, jti }, RESETPASSWORD_TOKEN_SECRET, { expiresIn: RESETPASSWORD_TOKEN_LIFE });
  }

  private verifyResetPasswordToken(token: string) {
    return this.jwt.verify(token, RESETPASSWORD_TOKEN_SECRET);
  }
}

export default AuthService;

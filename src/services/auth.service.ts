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
import axios from 'axios';
import { User, UserRole } from '@/entity';
import { AppDataSource } from '@/data-source';
import RedisService from './redis.service';
class AuthService {
  private jwt = jwt;
  private redisClient = RedisService.getInstance().getClient();
  private userRepository = AppDataSource.getRepository(User);
  private nodemailerService = new NodemailerService();
  public async signUpByEmail({ email, password, firstName, lastName }: { email: string; password: string; firstName: string; lastName: string }) {
    const exists = await this.userRepository.existsBy({ email, isActive: 1 });
    if (exists) throw new HttpException(409, errorStatus.EMAIL_EXISTED);
    const hashedPassword = hashSync(password, parseInt(SALTED_PASSWORD));
    // Turn on active status when user sign up again
    const deactiveUser = await this.userRepository.findOneBy({ email, isActive: 0 });
    if (deactiveUser) {
      await this.userRepository.update({ email, password: hashedPassword }, { isActive: 1 });
      return { email, password };
    }
    // Create new user
    const newUser = this.userRepository.create({
      email,
      password: hashedPassword,
      role: UserRole.User,
      firstName,
      lastName,
    });
    await this.userRepository.save(newUser);
    return { email, password };
  }

  public async signInByEmail({ email, password }: { email: string; password: string }) {
    const user = await this.userRepository.findOneBy({ email, isActive: 1 });
    if (!user) throw new HttpException(400, errorStatus.UNREGISTERED);
    const isPasswordMatched = compareSync(password, user.password.toString());
    if (!isPasswordMatched) throw new HttpException(400, errorStatus.WRONG_PASSWORD);
    const refreshToken = this.generateRefreshToken({ userId: user.userId });
    const accessToken = this.generateAccessToken({
      userId: user.userId,
      role: user.role.toString() as AuthJwtPayload['role'],
    });

    delete user.password;
    delete user.isActive;

    return { user, refreshToken, accessToken };
  }

  public async refreshToken(refreshToken: string) {
    if (!refreshToken) throw new HttpException(401, errorStatus.NO_CREDENTIALS);
    const { userId: refreshUserId } = this.verifyRefreshToken(refreshToken);
    const storedToken = await this.redisClient.get(`refresh_token:${refreshUserId}`);
    if (storedToken !== refreshToken) throw new HttpException(401, errorStatus.INVALID_TOKEN);
    const user = await this.userRepository.findOneBy({ userId: refreshUserId, isActive: 1 });
    if (!user) throw new HttpException(400, errorStatus.INVALID_TOKEN_PAYLOAD);
    const accessToken = this.generateAccessToken({ userId: user.userId.toString(), role: user.role });
    const newRefreshToken = this.generateRefreshToken({ userId: user.userId.toString() });
    return { accessToken, refreshToken: newRefreshToken };
  }

  public async forgotPassword(email: string, locale: string) {
    const user = await this.userRepository.findOneBy({ email, isActive: 1 });
    if (!user) throw new HttpException(400, errorStatus.UNREGISTERED);
    const token = this.generateResetPasswordToken({ email });
    const resetPasswordUrl = `${CLIENT_URL}/auth?type=reset&token=${token}`;
    await this.nodemailerService.sendResetPasswordMail(email, user?.firstName, resetPasswordUrl, locale);
    return { token };
  }

  public async resetPassword(newPassword: string, token: string) {
    const decodedToken = this.verifyResetPasswordToken(token) as JwtPayload;
    const email = decodedToken.email;
    const storedToken = await this.redisClient.get(`reset_password_token:${email}`);
    if (!storedToken) throw new HttpException(400, errorStatus.RESET_PASSWORD_EXPIRED);
    if (storedToken !== token) throw new HttpException(400, errorStatus.INVALID_RESET_PASSWORD_TOKEN);
    const newHashedPassword = hashSync(newPassword, parseInt(SALTED_PASSWORD));
    await this.userRepository.update({ email }, { password: newHashedPassword });
    await this.redisClient.del(`reset_password_token:${email}`);
    return { email: decodedToken.email, password: newPassword };
  }

  public async deactivateAccount({ userId, password }: { userId: string; password: string }) {
    const user = await this.userRepository.findOneBy({ userId, isActive: 1 });
    if (!user) throw new HttpException(400, errorStatus.USER_NOT_FOUND);
    const isPasswordMatched = compareSync(password, user.password?.toString());
    if (!isPasswordMatched) throw new HttpException(400, errorStatus.WRONG_PASSWORD);
    return await this.userRepository.update({ userId }, { isActive: 0 });
  }

  public async findUserById(id: string) {
    return await this.userRepository.findOne({
      where: { userId: id, isActive: 1 },
      select: ['userId', 'email', 'firstName', 'lastName', 'avatar', 'role', 'address', 'phoneNumber', 'address', 'createdAt'],
    });
  }

  public async googleAuthentication(googleAccessToken: string) {
    const userData = await this.getGoogleUserData(googleAccessToken);
    const { email_verified, family_name, given_name, email, picture } = userData;
    if (!email_verified) throw new HttpException(400, errorStatus.EMAIL_VERIFICATION_FAILED);
    const user = await this.userRepository.findOneBy({ email });
    if (user) {
      const refreshToken = this.generateRefreshToken({ userId: user.userId });
      const accessToken = this.generateAccessToken({
        userId: user.userId,
        role: user.role.toString() as AuthJwtPayload['role'],
      });
      if (!user.isActive) {
        await this.userRepository.update({ userId: user.userId }, { isActive: 1 });
      }
      delete user.password;
      delete user.isActive;
      return { user, refreshToken, accessToken, message: successStatus.GOOGLE_SIGN_IN_SUCCESSFULLY };
    } else {
      const password = email + GG_CLIENT_ID;
      const hashedPassword = hashSync(password, parseInt(SALTED_PASSWORD));
      const user = this.userRepository.create({
        email,
        password: hashedPassword,
        role: UserRole.User,
        firstName: given_name,
        lastName: family_name,
        avatar: picture,
      });
      await this.userRepository.save(user);
      const refreshToken = this.generateRefreshToken({ userId: user.userId });
      const accessToken = this.generateAccessToken({
        userId: user.userId,
        role: user.role.toString() as AuthJwtPayload['role'],
      });

      delete user.password;
      delete user.isActive;
      return { user, refreshToken, accessToken, message: successStatus.GOOGLE_SIGN_UP_SUCCESSFULLY };
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
    return this.jwt.sign({ userId, role }, ACCESS_TOKEN_SECRET, { expiresIn: parseInt(ACCESS_TOKEN_LIFE) ?? 3600 });
  }

  private generateRefreshToken({ userId }: AuthJwtPayload) {
    const token = this.jwt.sign({ userId }, REFRESH_TOKEN_SECRET, {
      expiresIn: parseInt(REFRESH_TOKEN_LIFE) ?? 2592000,
    });
    this.redisClient.setEx(`refresh_token:${userId}`, parseInt(REFRESH_TOKEN_LIFE) ?? 2592000, token);
    return token;
  }

  private verifyRefreshToken(token: string) {
    return this.jwt.verify(token, REFRESH_TOKEN_SECRET) as AuthJwtPayload;
  }

  private generateResetPasswordToken({ email }: { email: string }) {
    const token = this.jwt.sign({ email }, RESETPASSWORD_TOKEN_SECRET, {
      expiresIn: parseInt(RESETPASSWORD_TOKEN_LIFE) ?? 600,
    });
    this.redisClient.setEx(`reset_password_token:${email}`, parseInt(RESETPASSWORD_TOKEN_LIFE) ?? 600, token);
    return token;
  }

  private verifyResetPasswordToken(token: string) {
    return this.jwt.verify(token, RESETPASSWORD_TOKEN_SECRET);
  }
}

export default AuthService;

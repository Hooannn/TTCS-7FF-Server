import { errorStatus, SALTED_PASSWORD } from '@/config';
import { AppDataSource } from '@/data-source';
import { CartItem, CartItemStatus, Order, User } from '@/entity';
import { HttpException } from '@/exceptions/HttpException';
import { getStartOfTimeframe, getNow, getPreviousTimeframe, getEndOfTimeframe } from '@/utils/time';
import { compareSync, hashSync } from 'bcrypt';
class UsersService {
  private userRepository = AppDataSource.getRepository(User);
  private orderRepository = AppDataSource.getRepository(Order);
  private cartItemRepository = AppDataSource.getRepository(CartItem);

  public async findUserById(id: string) {
    return await this.userRepository.findOne({
      where: { userId: id, isActive: 1 },
      select: ['userId', 'email', 'firstName', 'lastName', 'avatar', 'role', 'address', 'phoneNumber', 'address', 'createdAt'],
    });
  }

  public async findUserByEmail(email: string) {
    return await this.userRepository.findOne({
      where: { email: email, isActive: 1 },
      select: ['userId', 'email', 'firstName', 'lastName', 'avatar', 'role', 'address', 'phoneNumber', 'address', 'createdAt'],
    });
  }

  public async getAllUsers({ skip, limit, filter, sort }: { skip?: number; limit?: number; filter?: string; sort?: string }) {
    const parseFilter = JSON.parse(filter ? filter : '{}');
    const parseSort = JSON.parse(sort ? sort : '{ "createdAt": "-1" }');
    const total = await this.userRepository.count({ select: ['userId'], where: parseFilter, order: parseSort });
    const users = await this.userRepository.find({
      where: parseFilter,
      order: parseSort,
      skip,
      take: limit,
      select: ['userId', 'email', 'firstName', 'lastName', 'avatar', 'role', 'address', 'phoneNumber', 'address', 'createdAt', 'isActive'],
    });
    return { total, users };
  }

  public async addUser(reqUser: User) {
    const { firstName, lastName, avatar, password, phoneNumber, role, email, address } = reqUser;
    const isEmailExisted = await this.userRepository.existsBy({ email, isActive: 1 });
    if (isEmailExisted) throw new HttpException(409, errorStatus.EMAIL_EXISTED);
    const hashedPassword = hashSync(password, parseInt(SALTED_PASSWORD));
    const user = this.userRepository.create({
      firstName,
      lastName,
      avatar,
      password: hashedPassword,
      phoneNumber,
      role,
      email,
      address,
    });
    await this.userRepository.save(user);

    delete user.password;
    delete user.isActive;
    return user;
  }

  public async deleteUser(userId: string) {
    return this.userRepository.update({ userId }, { isActive: 0 });
  }

  public async updateUser(userId: string, user: User) {
    let hashedPassword = null;
    const { resetPassword, lastName, firstName, phoneNumber, address, avatar, role } = user as any;
    if (resetPassword) {
      hashedPassword = hashSync(resetPassword, parseInt(SALTED_PASSWORD));
    }
    const updatedUser = hashedPassword
      ? { password: hashedPassword, lastName, firstName, phoneNumber, address, avatar, role }
      : { lastName, firstName, phoneNumber, address, avatar, role };
    return await this.userRepository.update({ userId }, updatedUser);
  }

  public async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.findUserById(userId);
    const isPasswordMatched = compareSync(currentPassword, user.password.toString());
    if (!isPasswordMatched) throw new HttpException(400, errorStatus.WRONG_PASSWORD);
    const hashedPassword = hashSync(newPassword, parseInt(SALTED_PASSWORD));
    await this.userRepository.update({ userId }, { password: hashedPassword });
    return user;
  }

  public async getSummaryUsers(to: number, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    return { currentCount: 0, previousCount: 0 };
  }

  public async getCartItems(userId: string) {
    const cartItems = await this.cartItemRepository.find({ where: { userId, status: CartItemStatus.Active }, relations: ['product'] });
    return { cartItems };
  }

  public async addCartItem({ userId, product, quantity }: { userId: string; product: string; quantity: number }) {
    const cartItem = await this.cartItemRepository.findOne({ where: { userId, productId: product, status: CartItemStatus.Active } });
    if (cartItem) {
      cartItem.quantity += quantity;
      await this.cartItemRepository.save(cartItem);
    } else {
      const newCartItem = this.cartItemRepository.create({ userId, productId: product, quantity });
      await this.cartItemRepository.save(newCartItem);
    }
  }

  public async removeCartItem({ userId, product, quantity }: { userId: string; product: string; quantity: number }) {
    const cartItem = await this.cartItemRepository.findOne({ where: { userId, productId: product, status: CartItemStatus.Active } });
    if (cartItem) {
      const newQuantity = cartItem.quantity - quantity;
      if (newQuantity < 1) {
        cartItem.status = CartItemStatus.Removed;
      } else {
        cartItem.quantity = newQuantity;
      }
      await this.cartItemRepository.save(cartItem);
    }
  }

  public async resetCartItems(userId: string) {
    return await this.cartItemRepository.update({ userId, status: CartItemStatus.Active }, { status: CartItemStatus.Removed });
  }

  public async getNewestUsers(type: 'daily' | 'weekly' | 'monthly' | 'yearly', limit = 5) {
    return [];
  }

  public async getUsersWithHighestTotalOrderValue(type: 'daily' | 'weekly' | 'monthly' | 'yearly', limit = 5) {
    return [];
  }
}

export default UsersService;

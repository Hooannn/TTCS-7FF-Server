import { errorStatus, SALTED_PASSWORD } from '@/config';
import { AppDataSource } from '@/data-source';
import { CartItem, CartItemStatus, Order, User, UserRole } from '@/entity';
import { HttpException } from '@/exceptions/HttpException';
import { parseCreatedAtFilter } from '@/utils/parseCreatedAtFilter';
import { getStartOfTimeframe, getNow, getPreviousTimeframe, getEndOfTimeframe } from '@/utils/time';
import { compareSync, hashSync } from 'bcrypt';
import dayjs from 'dayjs';
import { Between, FindManyOptions, FindOptions, FindOptionsWhere, LessThanOrEqual, Like, MoreThanOrEqual, Raw } from 'typeorm';
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
    const parseSort = JSON.parse(sort ? sort : '{ "createdAt": "DESC" }');

    if (parseFilter.email) parseFilter.email = Like(`%${parseFilter.email}%`);

    parseCreatedAtFilter(parseFilter);

    const where: FindOptionsWhere<User> = { ...parseFilter, role: UserRole.User, isActive: 1 };
    const total = await this.userRepository.count({ select: ['userId'], where, order: parseSort });
    const findOptions: FindManyOptions<User> = {
      where,
      order: parseSort,
      skip,
      take: limit,
      select: ['userId', 'email', 'firstName', 'lastName', 'avatar', 'role', 'address', 'phoneNumber', 'address', 'createdAt', 'isActive'],
    };
    if (!skip) delete findOptions.skip;
    if (!limit) delete findOptions.take;
    const users = await this.userRepository.find(findOptions);
    return { total, users };
  }

  public async getAllStaffs({ skip, limit, filter, sort }: { skip?: number; limit?: number; filter?: string; sort?: string }) {
    const parseFilter = JSON.parse(filter ? filter : '{}');
    const parseSort = JSON.parse(sort ? sort : '{ "createdAt": "DESC" }');

    if (parseFilter.email) parseFilter.email = Like(`%${parseFilter.email}%`);

    parseCreatedAtFilter(parseFilter);

    const where: FindOptionsWhere<User> = { ...parseFilter, role: UserRole.Staff, isActive: 1 };
    const total = await this.userRepository.count({ select: ['userId'], where, order: parseSort });
    const findOptions: FindManyOptions<User> = {
      where,
      order: parseSort,
      skip,
      take: limit ?? 0,
      select: ['userId', 'email', 'firstName', 'lastName', 'avatar', 'role', 'address', 'phoneNumber', 'address', 'createdAt', 'isActive'],
    };
    if (!skip) delete findOptions.skip;
    if (!limit) delete findOptions.take;
    const users = await this.userRepository.find(findOptions);
    return { total, users };
  }

  public async addUser(reqUser: User, role: UserRole) {
    const { firstName, lastName, avatar, password, phoneNumber, email, address } = reqUser;
    const isEmailExisted = await this.userRepository.existsBy({ email, isActive: 1 });
    if (isEmailExisted) throw new HttpException(409, errorStatus.EMAIL_EXISTED);
    const hashedPassword = hashSync(password, parseInt(SALTED_PASSWORD));
    const deletedUser = await this.userRepository.findOneBy({ email, isActive: 0 });
    if (deletedUser) {
      await this.userRepository.update(
        { userId: deletedUser.userId },
        {
          firstName,
          lastName,
          avatar,
          isActive: 1,
          password: hashedPassword,
          phoneNumber,
          role,
          email,
          address,
        },
      );
      delete deletedUser.password;
      delete deletedUser.isActive;
      return deletedUser;
    }
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
    const hasOrder = await this.orderRepository.existsBy({ customerId: userId });
    if (hasOrder) throw new HttpException(400, errorStatus.USER_HAS_ORDER);
    return this.userRepository.update({ userId, role: UserRole.User }, { isActive: 0 });
  }

  public async deleteStaff(userId: string) {
    const hasOrder = await this.orderRepository.existsBy({ customerId: userId });
    if (hasOrder) throw new HttpException(400, errorStatus.USER_HAS_ORDER);
    return this.userRepository.update({ userId, role: UserRole.Staff }, { isActive: 0 });
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
    return await this.userRepository.update({ userId, role: UserRole.User }, updatedUser);
  }

  public async updateProfile(userId: string, user: User) {
    const { lastName, firstName, phoneNumber, address, avatar } = user as any;
    return await this.userRepository.update({ userId }, { lastName, firstName, phoneNumber, address, avatar });
  }

  public async updateStaff(userId: string, user: User) {
    let hashedPassword = null;
    const { resetPassword, lastName, firstName, phoneNumber, address, avatar, role } = user as any;
    if (resetPassword) {
      hashedPassword = hashSync(resetPassword, parseInt(SALTED_PASSWORD));
    }
    const updatedUser = hashedPassword
      ? { password: hashedPassword, lastName, firstName, phoneNumber, address, avatar, role }
      : { lastName, firstName, phoneNumber, address, avatar, role };
    return await this.userRepository.update({ userId, role: UserRole.Staff }, updatedUser);
  }

  public async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userRepository.findOneBy({ userId, isActive: 1 });
    const isPasswordMatched = compareSync(currentPassword, user.password.toString());
    if (!isPasswordMatched) throw new HttpException(400, errorStatus.WRONG_PASSWORD);
    const hashedPassword = hashSync(newPassword, parseInt(SALTED_PASSWORD));
    await this.userRepository.update({ userId }, { password: hashedPassword });
    delete user.password;
    delete user.isActive;
    return user;
  }

  public async getSummaryUsers(to: number, type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const startDate = getStartOfTimeframe(getNow().valueOf(), type).valueOf();
    const currentCount = await this.userRepository
      .createQueryBuilder('user')
      .where('user.createdAt >= :startTime', { startTime: dayjs(startDate).format('YYYY-MM-DD HH:mm:ss') })
      .andWhere('user.createdAt <= :endTime', { endTime: dayjs(to).format('YYYY-MM-DD HH:mm:ss') })
      .andWhere('user.isActive = 1')
      .getCount();

    const previousTimeStart = getStartOfTimeframe(getPreviousTimeframe(to, type).valueOf(), type).valueOf();
    const previousTimeEnd = getEndOfTimeframe(previousTimeStart, type).valueOf();
    const previousCount = await this.userRepository
      .createQueryBuilder('user')
      .where('user.createdAt >= :startTime', { startTime: dayjs(previousTimeStart).format('YYYY-MM-DD HH:mm:ss') })
      .andWhere('user.createdAt <= :endTime', { endTime: dayjs(previousTimeEnd).format('YYYY-MM-DD HH:mm:ss') })
      .andWhere('user.isActive = 1')
      .getCount();

    return { currentCount, previousCount };
  }

  public async getCartItems(userId: string) {
    return (
      await this.cartItemRepository.find({
        where: { userId, status: CartItemStatus.Active, product: { isActive: 1, isAvailable: 1 } },
        relations: ['product', 'product.images'],
      })
    ).map(item => ({
      ...item,
      product: {
        ...item.product,
        featuredImages: item.product.images.map(image => image.imageUrl),
        price: item.product.currentPrice,
        name: { vi: item.product.nameVi, en: item.product.nameEn },
        description: { vi: item.product.descriptionVi, en: item.product.descriptionEn },
      },
    }));
  }

  public async addCartItem({ userId, product, quantity }: { userId: string; product: string; quantity: number }) {
    const cartItem = await this.cartItemRepository.findOne({ where: { userId, productId: product, status: CartItemStatus.Active } });
    if (cartItem) {
      cartItem.quantity += quantity;
      await this.cartItemRepository.save(cartItem);
    } else {
      const newCartItem = this.cartItemRepository.create({ userId, productId: product, quantity, status: CartItemStatus.Active });
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

  public async checkoutCartItems(userId: string) {
    return await this.cartItemRepository.update({ userId, status: CartItemStatus.Active }, { status: CartItemStatus.Purchased });
  }

  public async getNewestUsers(type: 'daily' | 'weekly' | 'monthly' | 'yearly', limit = 5) {
    const startDate = getStartOfTimeframe(getNow().valueOf(), type).toDate();
    return await this.userRepository.find({
      where: { createdAt: MoreThanOrEqual(startDate), isActive: 1 },
      order: { createdAt: 'DESC' },
      take: limit,
      select: ['userId', 'email', 'firstName', 'lastName', 'avatar', 'role', 'address', 'phoneNumber', 'address', 'createdAt'],
    });
  }

  public async getUsersWithHighestTotalOrderValue(type: 'daily' | 'weekly' | 'monthly' | 'yearly', limit = 5) {
    const startDate = getStartOfTimeframe(getNow().valueOf(), type).valueOf();

    const users = await this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.userId as userId',
        'user.email as email',
        'user.firstName as firstName',
        'user.lastName as lastName',
        'user.avatar as avatar',
        'user.role as role',
        'user.address as address',
        'user.phoneNumber as phoneNumber',
        'user.address as address',
        'user.createdAt as createdAt',
      ])
      .addSelect('SUM(order.totalPrice) as totalOrderValue')
      .innerJoin('ORDER', 'order', 'user.userId = order.customerId and order.status = "Done"')
      .where('order.createdAt >= :startDate', { startDate: dayjs(startDate).format('YYYY-MM-DD HH:mm:ss') })
      .andWhere('user.isActive = 1')
      .groupBy('user.userId')
      .orderBy('totalOrderValue', 'DESC')
      .limit(limit)
      .getRawMany();

    return users;
  }
}

export default UsersService;

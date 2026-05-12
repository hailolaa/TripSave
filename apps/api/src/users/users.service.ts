import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CartItem } from './cart-item.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(CartItem)
    private cartItemsRepository: Repository<CartItem>,
  ) {}

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findOneByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { google_id: googleId } });
  }

  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const saltOrRounds = 10;
    const password_hash = await bcrypt.hash(userData.password_hash || '', saltOrRounds);
    userData.password_hash = password_hash;
    
    const user = this.usersRepository.create(userData);
    
    return this.usersRepository.save(user);
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User | null> {
    await this.usersRepository.update(userId, data);
    return this.usersRepository.findOne({ where: { id: userId } });
  }

  // --- Cart Methods ---

  async getCart(userId: string): Promise<CartItem[]> {
    return this.cartItemsRepository.find({
      where: { user_id: userId },
      relations: ['product'],
      order: { created_at: 'DESC' },
    });
  }

  async addToCart(userId: string, productId: string, quantity: number = 1): Promise<CartItem> {
    let cartItem = await this.cartItemsRepository.findOne({
      where: { user_id: userId, product_id: productId },
    });

    if (cartItem) {
      cartItem.quantity += quantity;
    } else {
      cartItem = this.cartItemsRepository.create({
        user_id: userId,
        product_id: productId,
        quantity,
      });
    }

    return this.cartItemsRepository.save(cartItem);
  }

  async updateCartItem(userId: string, itemId: string, quantity: number): Promise<CartItem> {
    const cartItem = await this.cartItemsRepository.findOne({
      where: { id: itemId, user_id: userId },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    cartItem.quantity = quantity;
    return this.cartItemsRepository.save(cartItem);
  }

  async removeFromCart(userId: string, itemId: string): Promise<void> {
    await this.cartItemsRepository.delete({ id: itemId, user_id: userId });
  }
}

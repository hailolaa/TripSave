import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './user.entity';
import { Favorite } from './favorite.entity';
import { CartItem } from './cart-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Favorite, CartItem])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}

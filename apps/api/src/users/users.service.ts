import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const saltOrRounds = 10;
    const password_hash = await bcrypt.hash(userData.password_hash || '', saltOrRounds);
    userData.password_hash = password_hash;
    
    const user = this.usersRepository.create(userData);
    
    return this.usersRepository.save(user);
  }
}

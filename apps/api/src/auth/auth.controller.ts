import { Controller, Post, Get, Body, HttpCode, HttpStatus, BadRequestException, ConflictException, UnauthorizedException, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersService } from '../users/users.service';

class LoginDto {
  email: string;
  password: string;
}

class RegisterDto {
  name: string;
  email: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() body: LoginDto) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      throw new BadRequestException('Invalid email format');
    }

    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.authService.login(user);
  }

  @Post('register')
  async register(@Body() body: RegisterDto) {
    if (!body.name || !body.email || !body.password) {
      throw new BadRequestException('Name, email, and password are required');
    }

    if (body.name.trim().length < 2) {
      throw new BadRequestException('Name must be at least 2 characters');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      throw new BadRequestException('Invalid email format');
    }

    if (body.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    try {
      return await this.authService.register(body);
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw new ConflictException('An account with this email already exists');
      }
      throw e;
    }
  }

  @Post('google')
  async googleLogin(@Body('idToken') idToken: string) {
    if (!idToken) {
      throw new BadRequestException('Google ID token is required');
    }
    return this.authService.googleLogin(idToken);
  }

  @Post('verify-email')
  async verifyEmail(@Body() body: { email: string, code: string }) {
    if (!body.email || !body.code) {
      throw new BadRequestException('Email and verification code are required');
    }
    return this.authService.verifyEmail(body.email, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    const user = await this.usersService.findOneByEmail(req.user.email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const { password_hash, ...profile } = user;
    return profile;
  }
}



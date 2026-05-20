import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { WarmCacheService } from '../services/warm-cache.service';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient = new OAuth2Client();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
    private warmCacheService: WarmCacheService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) return null;
    if (user.password_hash && await bcrypt.compare(pass, user.password_hash)) {
      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        ...user,
        onboarding_completed: user.onboarding_completed,
        is_email_verified: user.is_email_verified,
      },
    };
  }

  async register(registerDto: any) {
    const existingUser = await this.usersService.findOneByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await this.usersService.create({
      email: registerDto.email,
      password_hash: registerDto.password,
      name: registerDto.name,
      verification_code: verificationCode,
      is_email_verified: true, // Auto-verify for now as requested
    });

    // Optional: still send the email in background but don't wait/block
    this.mailService.sendVerificationCode(user.email, verificationCode).catch(() => {});

    const tokenPayload = await this.login(user);

    // Fire priority cache warm asynchronously for their ZIP code
    if (registerDto.zip_code) {
      this.warmCacheService.warmNewUser(registerDto.zip_code).catch(err => {
        this.logger.error(`Failed to trigger new user cache warm: ${err.message}`);
      });
    }

    return tokenPayload;
  }

  async verifyEmail(email: string, code: string) {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.verification_code !== code) {
      throw new BadRequestException('Invalid verification code');
    }

    const updatedUser = await this.usersService.updateUser(user.id, {
      is_email_verified: true,
      verification_code: null as any,
    });

    return this.login(updatedUser);
  }

  async googleLogin(idToken: string) {
    try {
      const ticket = (await this.googleClient.verifyIdToken({
        idToken,
        audience: [
          process.env.GOOGLE_CLIENT_ID_ANDROID,
          process.env.GOOGLE_CLIENT_ID_IOS,
          process.env.GOOGLE_CLIENT_ID_WEB,
        ].filter((id): id is string => !!id),
      })) as any;

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google token');
      }

      const { sub: googleId, email, name, picture } = payload;

      let user = await this.usersService.findOneByGoogleId(googleId);

      if (!user) {
        // Check if user exists by email but not linked to Google
        user = await this.usersService.findOneByEmail(email);
        if (user) {
          user = await this.usersService.updateUser(user.id, { google_id: googleId, is_email_verified: true });
        } else {
          user = await this.usersService.create({
            email,
            name,
            google_id: googleId,
            is_email_verified: true, // Google emails are pre-verified
            password_hash: null as any, // No password for Google users
          });
        }
      }

      return this.login(user);
    } catch (e) {
      throw new UnauthorizedException('Google authentication failed');
    }
  }
}

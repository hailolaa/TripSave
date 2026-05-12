import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('MAIL_PORT', 587),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendVerificationCode(email: string, code: string) {
    const mailOptions = {
      from: `"TripSave" <${this.configService.get<string>('MAIL_FROM', 'noreply@tripsave.app')}>`,
      to: email,
      subject: 'Verify your TripSave account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #2563eb; text-align: center;">Welcome to TripSave!</h2>
          <p>Thank you for signing up. Please use the following verification code to complete your registration:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111827;">${code}</span>
          </div>
          <p>This code will expire in 10 minutes. If you did not request this code, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="font-size: 12px; color: #6b7280; text-align: center;">&copy; 2026 TripSave. All rights reserved.</p>
        </div>
      `,
    };

    try {
      if (this.configService.get<string>('NODE_ENV') === 'development' && !this.configService.get<string>('MAIL_USER')) {
        this.logger.warn('--- EMAIL VERIFICATION CODE (DEV MODE) ---');
        this.logger.warn(`To: ${email}`);
        this.logger.warn(`Code: ${code}`);
        this.logger.warn('-----------------------------------------');
        return;
      }
      
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}: ${error.message}`);
      // In a real app, you might want to throw an error here, 
      // but for now we'll log it and let the user know if they report issues.
    }
  }
}

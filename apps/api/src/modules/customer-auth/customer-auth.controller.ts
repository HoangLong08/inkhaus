import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CustomerAuthGuard, type CustomerRequest } from '../../common/guards/customer-auth.guard';
import { CustomerAuthService, toDto } from './customer-auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';

/**
 * Read from process.env rather than ConfigService: a decorator is evaluated when
 * the class is defined, long before DI exists. Same reasoning - and the same
 * shape - as the back office's limit, but its own number: the storefront is
 * public and busier, and throttling shoppers to the staff budget would be a
 * self-inflicted outage on a busy afternoon.
 */
const LOGIN_RATE_LIMIT = Number(process.env.CUSTOMER_LOGIN_RATE_LIMIT ?? 30);

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class CustomerAuthController {
  constructor(private readonly auth: CustomerAuthService) {}

  @Post('google')
  // the global throttler is 120/min, which is a brute-force budget rather than a
  // limit on a sign-in endpoint
  @Throttle({ default: { limit: LOGIN_RATE_LIMIT, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange a Google id_token for a storefront session token' })
  google(@Body() dto: GoogleLoginDto, @Req() req: CustomerRequest) {
    return this.auth.loginWithGoogle(dto.idToken, {
      userAgent: req.header('user-agent'),
      ip: req.ip,
    });
  }

  @Post('logout')
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the calling session' })
  logout(@Req() req: CustomerRequest) {
    const token = (req.header('authorization') ?? '').split(' ')[1] ?? '';
    return this.auth.logout(token);
  }

  @Get('me')
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Who the current storefront token belongs to' })
  me(@Req() req: CustomerRequest) {
    return toDto(req.customer!);
  }
}

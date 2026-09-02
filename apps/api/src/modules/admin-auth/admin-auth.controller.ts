import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard, type AdminRequest } from '../../common/guards/admin-auth.guard';
import { AdminAuthService, toDto } from './admin-auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';

/**
 * Read from process.env rather than ConfigService: a decorator is evaluated when
 * the class is defined, long before DI exists. Ten a minute is plenty for a
 * human with a slow finger; the e2e suite raises it because a browser test that
 * signs in twenty times is not an attack.
 */
const LOGIN_RATE_LIMIT = Number(process.env.ADMIN_LOGIN_RATE_LIMIT ?? 10);

@ApiTags('admin-auth')
@Controller({ path: 'admin/auth', version: '1' })
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('google')
  // the global throttler is 120/min, which is a brute-force budget rather than a
  // limit on a sign-in endpoint
  @Throttle({ default: { limit: LOGIN_RATE_LIMIT, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange a Google id_token for a session token' })
  google(@Body() dto: GoogleLoginDto, @Req() req: AdminRequest) {
    return this.auth.loginWithGoogle(dto.idToken, {
      userAgent: req.header('user-agent'),
      ip: req.ip,
    });
  }

  @Post('logout')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the calling session' })
  logout(@Req() req: AdminRequest) {
    const token = (req.header('authorization') ?? '').split(' ')[1] ?? '';
    return this.auth.logout(token);
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Who the current token belongs to' })
  me(@Req() req: AdminRequest) {
    return toDto(req.adminUser!);
  }
}

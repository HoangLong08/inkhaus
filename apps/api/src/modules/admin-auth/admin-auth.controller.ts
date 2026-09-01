import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard, type AdminRequest } from '../../common/guards/admin-auth.guard';
import { AdminAuthService, toDto } from './admin-auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('admin-auth')
@Controller({ path: 'admin/auth', version: '1' })
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  // the global throttler is 120/min, which is a brute-force budget rather than a
  // limit on a login form. Ten tries a minute per IP is plenty for a typo.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange staff credentials for a session token' })
  login(@Body() dto: LoginDto, @Req() req: AdminRequest) {
    return this.auth.login(dto, { userAgent: req.header('user-agent'), ip: req.ip });
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

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminUser } from '@prisma/client';

import { Can } from '../../common/decorators/can.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { AdminCatalogSettingsService } from './admin-catalog-settings.service';
import {
  AdminCreateColorDto,
  AdminCreateSizeDto,
  AdminReplaceTiersDto,
  AdminUpdateColorDto,
  AdminUpdateSizeDto,
} from './dto/admin-catalog-settings.dto';

/**
 * `admin/catalog/{colors,sizes,price-tiers}`. It owns the bare `admin/catalog`
 * prefix, so CatalogModule registers it after the products and options
 * controllers - a `:param` route here must never shadow theirs. Every route
 * below starts with a static segment, so none does.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/catalog', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminCatalogSettingsController {
  constructor(private readonly settings: AdminCatalogSettingsService) {}

  // ---------------------------------------------------------------- colours

  @Get('colors')
  @Can('catalog.view')
  @ApiOperation({ summary: 'Every colour, archived included, with product and order-line counts' })
  colors() {
    return this.settings.colors();
  }

  @Post('colors')
  @Can('catalog.edit')
  @ApiOperation({ summary: 'A new colour' })
  createColor(@CurrentAdmin() admin: AdminUser, @Body() dto: AdminCreateColorDto) {
    return this.settings.createColor(admin, dto);
  }

  @Patch('colors/:slug')
  @Can('catalog.edit')
  @ApiOperation({ summary: 'Rename, recolour, reorder or archive a colour - there is no delete' })
  updateColor(
    @CurrentAdmin() admin: AdminUser,
    @Param('slug') slug: string,
    @Body() dto: AdminUpdateColorDto,
  ) {
    return this.settings.updateColor(admin, slug, dto);
  }

  // ------------------------------------------------------------------ sizes

  @Get('sizes')
  @Can('catalog.view')
  @ApiOperation({ summary: 'Every size code with its upcharge and how many products stock it' })
  sizes() {
    return this.settings.sizes();
  }

  @Post('sizes')
  @Can('catalog.price')
  @ApiOperation({ summary: 'A new size code - owners only, and 409 while price edits are off' })
  createSize(@CurrentAdmin() admin: AdminUser, @Body() dto: AdminCreateSizeDto) {
    return this.settings.createSize(admin, dto);
  }

  /** an `upcharge` in the body additionally needs `catalog.price` and price edits on */
  @Patch('sizes/:code')
  @Can('catalog.edit')
  @ApiOperation({ summary: 'Relabel or reorder a size; its upcharge is owner-only' })
  updateSize(
    @CurrentAdmin() admin: AdminUser,
    @Param('code') code: string,
    @Body() dto: AdminUpdateSizeDto,
  ) {
    return this.settings.updateSize(admin, code, dto);
  }

  @Delete('sizes/:code')
  @Can('catalog.price')
  @ApiOperation({ summary: 'Delete a size nothing uses - 409 for the default run or a stocked code' })
  deleteSize(@CurrentAdmin() admin: AdminUser, @Param('code') code: string) {
    return this.settings.deleteSize(admin, code);
  }

  // ------------------------------------------------------------ price tiers

  @Get('price-tiers')
  @Can('catalog.view')
  @ApiOperation({ summary: 'The volume discount ladder, in the shape PUT takes back' })
  tiers() {
    return this.settings.tiers();
  }

  @Put('price-tiers')
  @Can('catalog.price')
  @ApiOperation({ summary: 'Replace the whole ladder - owners only, and 409 while price edits are off' })
  replaceTiers(@CurrentAdmin() admin: AdminUser, @Body() dto: AdminReplaceTiersDto) {
    return this.settings.replaceTiers(admin, dto);
  }
}

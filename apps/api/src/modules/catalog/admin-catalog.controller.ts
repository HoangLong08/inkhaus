import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminUser } from '@prisma/client';

import { Can } from '../../common/decorators/can.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminListProductsDto } from './dto/admin-list-products.dto';
import { AdminCreateProductDto, AdminUpdateProductDto } from './dto/admin-product.dto';

/** Products in the back office - list, detail, create, edit. Archived, never deleted. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/catalog/products', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminCatalogController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get()
  @Can('catalog.view')
  @ApiOperation({ summary: 'Products, archived included - search, filter, sort, paginate' })
  list(@Query() query: AdminListProductsDto) {
    return this.catalog.list(query);
  }

  @Get(':slug')
  @Can('catalog.view')
  @ApiOperation({ summary: 'One product with its colours, images, order count and history' })
  detail(@Param('slug') slug: string) {
    return this.catalog.detail(slug);
  }

  @Post()
  @Can('catalog.create')
  @ApiOperation({
    summary: 'A new blank - owners only, and 409 while CATALOG_PRICE_EDITS is off',
  })
  create(@CurrentAdmin() admin: AdminUser, @Body() dto: AdminCreateProductDto) {
    return this.catalog.create(admin, dto);
  }

  /**
   * `catalog.edit` is the floor. `price`/`bulkPrice` in the body additionally
   * need `catalog.price` (403) and CATALOG_PRICE_EDITS (409) - the service
   * checks both, since they depend on the body and not on the route.
   */
  @Patch(':slug')
  @Can('catalog.edit')
  @ApiOperation({ summary: 'Edit a product; price fields are owner-only and need price edits on' })
  update(
    @CurrentAdmin() admin: AdminUser,
    @Param('slug') slug: string,
    @Body() dto: AdminUpdateProductDto,
  ) {
    return this.catalog.update(admin, slug, dto);
  }
}

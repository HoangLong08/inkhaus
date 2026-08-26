import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CatalogService } from './catalog.service';
import { ListProductsDto } from './dto/list-products.dto';

@ApiTags('catalog')
@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  @ApiOperation({ summary: 'List the blanks, in the shape the storefront renders' })
  @ApiOkResponse({ description: 'Product[] - same fields the old src/lib/catalog.ts exported' })
  listProducts(@Query() query: ListProductsDto) {
    return this.catalog.listProducts(query);
  }

  @Get('products/:slug')
  @ApiOperation({ summary: 'One blank by slug' })
  getProduct(@Param('slug') slug: string) {
    return this.catalog.getProduct(slug);
  }

  @Get('colors')
  listColors() {
    return this.catalog.listColors();
  }

  @Get('sizes')
  listSizes() {
    return this.catalog.listSizes();
  }

  @Get('price-tiers')
  @ApiOperation({ summary: 'The volume discount ladder' })
  listTiers() {
    return this.catalog.listTiers();
  }

  @Get('print-methods')
  listMethods() {
    return this.catalog.listMethods();
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AssetsService } from './assets.service';

@ApiTags('assets')
@Controller({ path: 'assets', version: '1' })
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get('clipart')
  @ApiOperation({ summary: 'Clip art library for the design studio' })
  @ApiQuery({ name: 'q', required: false, description: 'search name or tag' })
  listClipart(@Query('q') q?: string) {
    return this.assets.listClipart(q);
  }

  @Get('fonts')
  listFonts() {
    return this.assets.listFonts();
  }

  @Get('ink-colors')
  listInks() {
    return this.assets.listInks();
  }
}

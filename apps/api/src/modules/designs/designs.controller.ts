import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { DesignsService } from './designs.service';
import { CreateDesignDto } from './dto/create-design.dto';
import { UpdateDesignDto } from './dto/update-design.dto';

@ApiTags('designs')
@Controller({ path: 'designs', version: '1' })
export class DesignsController {
  constructor(private readonly designs: DesignsService) {}

  @Post()
  @ApiOperation({ summary: 'Save a studio scene and get a shareable id back' })
  create(@Body() dto: CreateDesignDto) {
    return this.designs.create(dto);
  }

  // The three endpoints below take an email or someone else's design id and had
  // no gate at all: anyone could enumerate every design saved under an address,
  // or delete one. The storefront only ever calls POST / and GET /:publicId
  // (see apps/web/src/lib/api.ts), so back office is the right audience until
  // customer accounts exist.

  @Get()
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Designs saved under an email' })
  list(@Query('email') email: string) {
    return this.designs.listForCustomer(email ?? '');
  }

  /// public on purpose - publicId is the share link the studio hands out
  @Get(':publicId')
  find(@Param('publicId') publicId: string) {
    return this.designs.findByPublicId(publicId);
  }

  @Patch(':publicId')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  update(@Param('publicId') publicId: string, @Body() dto: UpdateDesignDto) {
    return this.designs.update(publicId, dto);
  }

  @Delete(':publicId')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  remove(@Param('publicId') publicId: string) {
    return this.designs.remove(publicId);
  }
}

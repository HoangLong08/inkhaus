import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

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

  @Get()
  @ApiOperation({ summary: 'Designs saved under an email' })
  list(@Query('email') email: string) {
    return this.designs.listForCustomer(email ?? '');
  }

  @Get(':publicId')
  find(@Param('publicId') publicId: string) {
    return this.designs.findByPublicId(publicId);
  }

  @Patch(':publicId')
  update(@Param('publicId') publicId: string, @Body() dto: UpdateDesignDto) {
    return this.designs.update(publicId, dto);
  }

  @Delete(':publicId')
  remove(@Param('publicId') publicId: string) {
    return this.designs.remove(publicId);
  }
}

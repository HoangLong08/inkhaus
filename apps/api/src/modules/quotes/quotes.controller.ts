import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminUser } from '@prisma/client';

import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CreateBulkQuoteDto } from './dto/create-quote.dto';
import { ListBulkQuotesDto } from './dto/list-quotes.dto';
import { UpdateBulkQuoteDto } from './dto/update-quote.dto';
import { QuotesService } from './quotes.service';

@ApiTags('bulk-quotes')
@Controller({ path: 'bulk-quotes', version: '1' })
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Post()
  @ApiOperation({ summary: 'Bulk enquiry from the /bulk calculator' })
  create(@Body() dto: CreateBulkQuoteDto) {
    return this.quotes.create(dto);
  }

  // The two routes below are the old back office's, kept for it and its e2e
  // suite (decision D1) and superseded by /admin/bulk-quotes.

  @Get()
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk quote list - use GET /admin/bulk-quotes', deprecated: true })
  list(@Query() query: ListBulkQuotesDto) {
    return this.quotes.list(query);
  }

  @Patch(':id')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Set a quote's status; `message` is added as a staff note, never over the customer's",
    deprecated: true,
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBulkQuoteDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    return this.quotes.update(id, dto, { id: admin.id });
  }
}

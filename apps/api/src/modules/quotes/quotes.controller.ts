import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { AdminKeyGuard } from '../../common/guards/admin-key.guard';
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

  @Get()
  @UseGuards(AdminKeyGuard)
  @ApiSecurity('admin-key')
  list(@Query() query: ListBulkQuotesDto) {
    return this.quotes.list(query);
  }

  @Patch(':id')
  @UseGuards(AdminKeyGuard)
  @ApiSecurity('admin-key')
  update(@Param('id') id: string, @Body() dto: UpdateBulkQuoteDto) {
    return this.quotes.update(id, dto);
  }
}

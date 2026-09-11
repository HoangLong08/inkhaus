import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminUser } from '@prisma/client';

import { Can } from '../../common/decorators/can.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import type { Paginated } from '../../common/dto/pagination.dto';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { patchFromInput } from './admin-quotes.rules';
import {
  AdminQuotesService,
  type AdminQuoteDetail,
  type AdminQuoteListItem,
} from './admin-quotes.service';
import { AdminListQuotesDto } from './dto/admin-list-quotes.dto';
import { AdminUpdateQuoteDto } from './dto/admin-update-quote.dto';
import { ConvertQuoteDto } from './dto/convert-quote.dto';
import { QuoteNoteDto } from './dto/quote-note.dto';
import { QuoteConversionService } from './quote-conversion.service';
import { QuoteWorkflowService } from './quote-workflow.service';

/**
 * Bulk quotes in the back office - triage, notes, conversion to an order.
 *
 * Every write answers with the quote's full detail as it now stands, so the
 * admin's cache takes the server's word for the timeline rather than guessing
 * at the events a change produced.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/bulk-quotes', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminQuotesController {
  constructor(
    private readonly quotes: AdminQuotesService,
    private readonly workflow: QuoteWorkflowService,
    private readonly conversion: QuoteConversionService,
  ) {}

  @Get()
  @Can('quotes.manage')
  @ApiOperation({ summary: 'Quote list - search, filter by status, assignee and follow-up' })
  list(
    @Query() query: AdminListQuotesDto,
    @CurrentAdmin() admin: AdminUser,
  ): Promise<Paginated<AdminQuoteListItem>> {
    return this.quotes.list(query, admin.id);
  }

  @Get(':id')
  @Can('quotes.manage')
  @ApiOperation({ summary: 'One quote with its customer, history and a live re-estimate' })
  detail(@Param('id') id: string): Promise<AdminQuoteDetail> {
    return this.quotes.detail(id);
  }

  @Patch(':id')
  @Can('quotes.manage')
  @ApiOperation({
    summary: 'Change status, assignee and/or follow-up day - one timeline event per changed field',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateQuoteDto,
    @CurrentAdmin() admin: AdminUser,
  ): Promise<AdminQuoteDetail> {
    await this.workflow.update(id, patchFromInput(dto), { id: admin.id });
    return this.quotes.detail(id);
  }

  @Post(':id/notes')
  @Can('quotes.manage')
  @ApiOperation({ summary: 'Add a staff note to the quote history' })
  async addNote(
    @Param('id') id: string,
    @Body() dto: QuoteNoteDto,
    @CurrentAdmin() admin: AdminUser,
  ): Promise<AdminQuoteDetail> {
    await this.workflow.addNote(id, dto.note, { id: admin.id });
    return this.quotes.detail(id);
  }

  @Post(':id/convert')
  @Can('quotes.convert')
  @ApiOperation({
    summary: 'Turn the quote into a DRAFT order priced from the database; the quote becomes WON',
  })
  async convert(
    @Param('id') id: string,
    @Body() dto: ConvertQuoteDto,
    @CurrentAdmin() admin: AdminUser,
  ): Promise<{ order: { number: string }; quote: AdminQuoteDetail }> {
    const order = await this.conversion.convert(id, dto, { id: admin.id });
    return { order: { number: order.number }, quote: await this.quotes.detail(id) };
  }
}

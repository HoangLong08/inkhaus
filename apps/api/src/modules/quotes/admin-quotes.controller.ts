import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { AdminQuotesService } from './admin-quotes.service';
import { QuoteConversionService } from './quote-conversion.service';
import { QuoteWorkflowService } from './quote-workflow.service';

/** Bulk quotes in the back office - triage, notes, conversion to an order. */
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
}

import { Readable } from 'node:stream';

import {
  Controller,
  Get,
  Header,
  Logger,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { AdminUser } from '@prisma/client';
import type { Response } from 'express';

import { Can } from '../../common/decorators/can.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { ORDER_EXPORT_MAX } from './admin-order-export.csv';
import { AdminOrdersService } from './admin-orders.service';
import { ExportOrdersDto } from './dto/export-orders.dto';

/**
 * Bulk exports of personal data. Owner-only (`orders.export`) and always
 * audited (decision D6); every cell goes through `csvCell` in common/csv.ts,
 * which is where the spreadsheet-formula guard lives.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/exports', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminOrderExportController {
  private readonly logger = new Logger(AdminOrderExportController.name);

  constructor(private readonly orders: AdminOrdersService) {}

  /**
   * Streams rather than builds the file: ten thousand rows are read in batches
   * as the client takes them, and never sit in memory whole.
   */
  @Get('orders.csv')
  @Can('orders.export')
  // a list of customers' names and addresses has no business in a cache
  @Header('Cache-Control', 'no-store')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: `Orders matching the list's filters as CSV - owners only, audited, at most ${ORDER_EXPORT_MAX} rows (X-Export-Truncated: true past that)`,
  })
  async ordersCsv(
    @Query() filter: ExportOrdersDto,
    @CurrentAdmin() admin: AdminUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.orders.exportCsv(filter, admin);
    if (file.truncated) res.setHeader('X-Export-Truncated', 'true');

    return new StreamableFile(Readable.from(file.body), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${file.filename}"`,
    }).setErrorHandler((err) => {
      this.logger.error(`orders export failed while streaming: ${err.message}`);
      // By now the headers and part of the file are out. Nest's default ends
      // the response cleanly, which hands the owner a file that stops half way
      // and looks whole; cutting the connection makes the download fail instead.
      res.destroy(err);
    });
  }
}

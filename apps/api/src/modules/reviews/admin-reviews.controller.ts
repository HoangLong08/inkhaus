import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminUser } from '@prisma/client';

import { Can } from '../../common/decorators/can.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { AdminReviewsService } from './admin-reviews.service';
import { AdminBulkModerateReviewsDto } from './dto/admin-bulk-moderate-reviews.dto';
import { AdminListReviewsDto } from './dto/admin-list-reviews.dto';
import { AdminModerateReviewDto } from './dto/admin-moderate-review.dto';

/**
 * Review moderation in the back office. Staff moderate; only an owner deletes.
 *
 * `bulk` is declared before the `:id` routes. It is a POST and they are not,
 * so nothing shadows it today - but a `GET :id` added later would, and route
 * order is the kind of thing nobody re-reads when adding one.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/reviews', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminReviewsController {
  constructor(private readonly reviews: AdminReviewsService) {}

  @Get()
  @Can('reviews.moderate')
  @ApiOperation({ summary: 'Reviews, newest first - filter by status, rating, product; search text' })
  list(@Query() query: AdminListReviewsDto) {
    return this.reviews.list(query);
  }

  @Post('bulk')
  @Can('reviews.moderate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move up to 50 reviews to one status, all or nothing' })
  bulk(@Body() dto: AdminBulkModerateReviewsDto, @CurrentAdmin() admin: AdminUser) {
    return this.reviews.bulkModerate(dto.ids, dto.status, admin);
  }

  @Patch(':id')
  @Can('reviews.moderate')
  @ApiOperation({ summary: 'Publish, reject, or send one review back to pending' })
  moderate(
    @Param('id') id: string,
    @Body() dto: AdminModerateReviewDto,
    @CurrentAdmin() admin: AdminUser,
  ) {
    return this.reviews.moderate(id, dto.status, admin);
  }

  @Delete(':id')
  @Can('reviews.delete')
  @ApiOperation({ summary: 'Delete a review for good (owner only); the audit log keeps a copy' })
  remove(@Param('id') id: string, @CurrentAdmin() admin: AdminUser) {
    return this.reviews.remove(id, admin);
  }
}

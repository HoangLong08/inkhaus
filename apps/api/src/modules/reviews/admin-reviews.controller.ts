import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { AdminReviewsService } from './admin-reviews.service';

/** Review moderation in the back office. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/reviews', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminReviewsController {
  constructor(private readonly reviews: AdminReviewsService) {}
}

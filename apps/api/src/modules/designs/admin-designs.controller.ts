import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { DesignsService } from './designs.service';

/**
 * Customer artwork in the back office. The preview an order page shows is
 * `orders.view`; anything that lists a customer's designs wholesale is
 * `designs.view`, which is owner-only.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/designs', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminDesignsController {
  constructor(private readonly designs: DesignsService) {}
}

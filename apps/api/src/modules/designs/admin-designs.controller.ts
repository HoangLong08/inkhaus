import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Can } from '../../common/decorators/can.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { DesignsService } from './designs.service';
import { DesignPublicIdParamsDto } from './dto/design-public-id.params';

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

  /**
   * One design by id, as the order page draws it. `orders.view` rather than
   * `designs.view`: knowing the id is the point - it comes off an order line,
   * and the same id is already a public share link on the storefront.
   */
  @Get(':publicId/preview')
  @Can('orders.view')
  @ApiOperation({ summary: "A design's name and mockup previews - never the studio scene" })
  preview(@Param() params: DesignPublicIdParamsDto) {
    return this.designs.preview(params.publicId);
  }
}

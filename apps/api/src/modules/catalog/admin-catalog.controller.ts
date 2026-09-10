import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { CapabilityGuard } from '../../common/guards/capability.guard';
import { AdminCatalogService } from './admin-catalog.service';

/** Products in the back office - list, detail, create, edit. Archived, never deleted. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/catalog/products', version: '1' })
@UseGuards(AdminAuthGuard, CapabilityGuard)
export class AdminCatalogController {
  constructor(private readonly catalog: AdminCatalogService) {}
}

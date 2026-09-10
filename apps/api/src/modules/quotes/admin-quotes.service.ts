import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

/** back-office reads of bulk quotes; writes go through QuoteWorkflowService */
@Injectable()
export class AdminQuotesService {
  constructor(private readonly prisma: PrismaService) {}
}

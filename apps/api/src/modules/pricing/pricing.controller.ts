import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { QuoteDto } from './dto/quote.dto';
import { PricingService } from './pricing.service';

@ApiTags('pricing')
@Controller({ path: 'pricing', version: '1' })
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Price a size/quantity grid against the live ladder' })
  quote(@Body() dto: QuoteDto) {
    return this.pricing.quote(dto);
  }
}

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller({ path: 'reviews', version: '1' })
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiQuery({ name: 'product', required: false })
  @ApiQuery({ name: 'limit', required: false })
  list(@Query('product') product?: string, @Query('limit') limit?: number) {
    return this.reviews.list(product, limit ? Number(limit) : 12);
  }

  @Post()
  @ApiOperation({ summary: 'Leave a review - held for moderation' })
  create(@Body() dto: CreateReviewDto) {
    return this.reviews.create(dto);
  }
}

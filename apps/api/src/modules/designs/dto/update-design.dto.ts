import { PartialType } from '@nestjs/swagger';

import { CreateDesignDto } from './create-design.dto';

export class UpdateDesignDto extends PartialType(CreateDesignDto) {}

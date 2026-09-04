import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleLoginDto {
  /// the raw id_token from Google's token endpoint. Length bounds only - every
  /// claim inside is checked against Google's JWKS in the service.
  @ApiProperty({ description: 'Google OIDC id_token' })
  @IsString()
  @MinLength(20)
  @MaxLength(8192)
  idToken!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner@inkhaus.test' })
  @IsEmail()
  @MaxLength(200)
  email!: string;

  /// only a floor, not a policy - the real strength requirement lives wherever
  /// accounts are created, and a legacy short password must still be able to
  /// sign in to change itself
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

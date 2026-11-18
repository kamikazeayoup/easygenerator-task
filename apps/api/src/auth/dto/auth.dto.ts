import { Expose, Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { signUpPasswordPattern } from '../validation/sign-up-password.js';

abstract class AuthEmailDto {
  @Expose()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value, { toClassOnly: true })
  @IsEmail({ allow_utf8_local_part: false, ignore_max_length: true }, { message: 'Enter a valid email address.' })
  @MaxLength(254, { message: 'Email must be at most 254 characters.' })
  @IsString({ message: 'Email must be a string.' })
  email!: string;
}

export class SignInDto extends AuthEmailDto {
  @Expose()
  @Length(1, 128, { message: 'Password must be between 1 and 128 characters.' })
  @IsString({ message: 'Password must be a string.' })
  password!: string;
}

export class SignUpDto extends AuthEmailDto {
  @Expose()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value, { toClassOnly: true })
  @Length(3, 100, { message: 'Name must be between 3 and 100 characters.' })
  @IsString({ message: 'Name must be a string.' })
  name!: string;

  @Expose()
  @Matches(signUpPasswordPattern, { message: 'Include an ASCII letter, digit, and punctuation character.' })
  @Length(8, 128, { message: 'Password must be between 8 and 128 characters.' })
  @IsString({ message: 'Password must be a string.' })
  password!: string;
}

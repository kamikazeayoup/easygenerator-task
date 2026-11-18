import { BadRequestException } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import type { ClassConstructor } from 'class-transformer';
import { validateAuthRequest } from '../validation/auth-request.validation.js';

export class AuthRequestPipe<T extends object> implements PipeTransform<unknown, T> {
  constructor(private readonly dto: ClassConstructor<T>) {}

  transform(value: unknown): T {
    const result = validateAuthRequest(this.dto, value);
    if (result.success) return result.data;

    throw new BadRequestException({
      statusCode: 400,
      message: 'Invalid request.',
      fieldErrors: result.fieldErrors,
      formErrors: result.formErrors,
    });
  }
}

import { plainToInstance } from 'class-transformer';
import type { ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; fieldErrors: Record<string, string[]>; formErrors: string[] };

export function validateAuthRequest<T extends object>(dto: ClassConstructor<T>, body: unknown): ValidationResult<T> {
  if (body === null || Array.isArray(body) || typeof body !== 'object') {
    const received = body === null ? 'null' : Array.isArray(body) ? 'array' : typeof body;
    return {
      success: false,
      fieldErrors: {},
      formErrors: [`Invalid input: expected object, received ${received}`],
    };
  }

  const data = plainToInstance(dto, body, { excludeExtraneousValues: true });
  const errors = validateSync(data, {
    forbidUnknownValues: true,
    stopAtFirstError: true,
    validationError: { target: false, value: false },
  });
  if (errors.length === 0) return { success: true, data };

  return {
    success: false,
    fieldErrors: Object.fromEntries(errors.map(({ property, constraints }) => [property, Object.values(constraints ?? {})])),
    formErrors: [],
  };
}

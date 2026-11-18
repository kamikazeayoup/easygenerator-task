import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';
import { AuthApiError } from './auth-api';

export function reportFormError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly FieldPath<T>[],
  fallback: string,
) {
  let message = fallback;

  if (error instanceof AuthApiError) {
    if (error.status === 400 || error.status === 409) {
      let focusFirst = true;
      for (const field of fields) {
        const fieldMessage = error.validation?.fieldErrors?.[field]?.[0];
        if (!fieldMessage) continue;
        setError(field, { type: 'server', message: fieldMessage }, { shouldFocus: focusFirst });
        focusFirst = false;
      }
      const formMessage = error.validation?.formErrors?.[0];
      if (!focusFirst && !formMessage) return;
      message = formMessage ?? 'Check your entries and try again.';
    } else if (error.status === 401) {
      message = 'The email or password is incorrect.';
    } else if (error.status === 429) {
      const seconds = error.retryAfterSeconds;
      if (seconds) {
        const duration = seconds < 60 ? seconds : Math.ceil(seconds / 60);
        const unit = seconds < 60 ? 'second' : 'minute';
        const wait = new Intl.NumberFormat('en', { style: 'unit', unit, unitDisplay: 'long' }).format(duration);
        message = `Too many attempts. Try again in ${wait}.`;
      } else {
        message = 'Too many attempts. Wait a moment and try again.';
      }
    }
  }

  setError('root.server', { type: 'server', message });
}

import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

type FormFieldProps = Pick<InputHTMLAttributes<HTMLInputElement>, 'type' | 'autoComplete' | 'placeholder'> & {
  registration: UseFormRegisterReturn;
  label: string;
  error?: string;
  hint?: string;
};

export function FormField({ registration, label, error, hint, type = 'text', ...inputProps }: FormFieldProps) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ');

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className={isPassword ? 'field-control field-control--password' : 'field-control'}>
        <input
          {...registration}
          {...inputProps}
          id={id}
          type={isPassword && showPassword ? 'text' : type}
          autoCapitalize={type !== 'text' ? 'none' : undefined}
          spellCheck={type === 'text' ? undefined : false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          required
        />
        {isPassword && (
          <button
            className="password-toggle"
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        )}
      </div>
      {error && <p className="field-error" id={`${id}-error`} role="alert">{error}</p>}
      {hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}

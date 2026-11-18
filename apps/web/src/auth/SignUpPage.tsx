import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { AppLayout } from '../components/AppLayout';
import { FormField } from '../components/FormField';
import { Notice } from '../components/Notice';
import { PageHeading } from '../components/PageHeading';
import { authApi } from './auth-api';
import { passwordRequirements, signUpSchema } from './auth-schemas';
import type { SignUpInput } from './auth-schemas';
import { reportFormError } from './form-errors';

export function SignUpPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
  });

  async function signUp(input: SignUpInput) {
    try {
      await authApi.signUp(input);
      navigate('/sign-in', { replace: true, state: { fromSignUp: true } });
    } catch (error) {
      reportFormError(error, setError, ['name', 'email', 'password'], 'We couldn’t submit your details. Try again.');
    }
  }

  return (
    <AppLayout navigation={<>Already have an account? <Link to="/sign-in">Sign in</Link></>}>
      <div className="page-heading">
        <PageHeading>Create an account</PageHeading>
      </div>
      <form className="auth-form" onSubmit={handleSubmit(signUp)} noValidate aria-busy={isSubmitting}>
        <FormField
          registration={register('name')}
          label="Name"
          autoComplete="name"
          placeholder="Your name"
          error={errors.name?.message}
        />
        <FormField
          registration={register('email')}
          label="Email address"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          error={errors.email?.message}
        />
        <FormField
          registration={register('password')}
          label="Password"
          type="password"
          autoComplete="new-password"
          hint={passwordRequirements}
          error={errors.password?.message}
        />
        {errors.root?.server?.message && <Notice kind="error">{errors.root.server.message}</Notice>}
        <button className="button button--primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting…' : 'Create account'}
          <ArrowRight aria-hidden="true" />
        </button>
      </form>
    </AppLayout>
  );
}

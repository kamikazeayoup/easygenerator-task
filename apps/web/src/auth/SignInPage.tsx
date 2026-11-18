import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { AppLayout } from '../components/AppLayout';
import { FormField } from '../components/FormField';
import { Notice } from '../components/Notice';
import { PageHeading } from '../components/PageHeading';
import { authApi } from './auth-api';
import { signInSchema } from './auth-schemas';
import type { SignInInput } from './auth-schemas';
import { reportFormError } from './form-errors';
import { useAuthStore } from './auth-store';

export function SignInPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const checkLogin = useAuthStore((store) => store.checkLogin);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
  });

  async function signIn(input: SignInInput) {
    try {
      await authApi.signIn(input);
      void checkLogin();
      navigate('/app', { replace: true });
    } catch (error) {
      reportFormError(error, setError, ['email', 'password'], 'We couldn’t sign you in. Try again.');
    }
  }

  return (
    <AppLayout navigation={<>New to Easygenerator? <Link to="/sign-up">Create an account</Link></>}>
      <div className="page-heading">
        <PageHeading>Sign in</PageHeading>
      </div>
      <form className="auth-form" onSubmit={handleSubmit(signIn)} noValidate aria-busy={isSubmitting}>
        {state?.fromSignUp === true && <Notice kind="success">Continue by signing in.</Notice>}
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
          autoComplete="current-password"
          error={errors.password?.message}
        />
        {errors.root?.server?.message && <Notice kind="error">{errors.root.server.message}</Notice>}
        <button className="button button--primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
          <ArrowRight aria-hidden="true" />
        </button>
      </form>
    </AppLayout>
  );
}

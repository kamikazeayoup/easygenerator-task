import { CircleAlert, CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';

type NoticeProps = {
  children: ReactNode;
  kind: 'error' | 'success';
};

export function Notice({ children, kind }: NoticeProps) {
  const Icon = kind === 'error' ? CircleAlert : CircleCheck;

  return (
    <div className={`notice notice--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

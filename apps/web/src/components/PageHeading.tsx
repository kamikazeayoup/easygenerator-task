import { useEffect, useRef } from 'react';

export function PageHeading({ children }: { children: string }) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = `${children} | Easygenerator`;
    heading.current?.focus({ preventScroll: true });
  }, [children]);

  return <h1 ref={heading} tabIndex={-1}>{children}</h1>;
}

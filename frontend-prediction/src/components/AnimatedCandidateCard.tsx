import type { ReactNode } from 'react';
import React from 'react';
import { useBoxEntrance } from '@hooks/useGSAPAnimation';

interface AnimatedCandidateCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  delay: number;
}

export function AnimatedCandidateCard({ children, delay, className, ...props }: AnimatedCandidateCardProps) {
  const cardRef = useBoxEntrance(delay);

  return (
    <div ref={cardRef} className={className} {...props}>
      {children}
    </div>
  );
}

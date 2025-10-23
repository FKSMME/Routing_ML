import { useHoverScale, useMouseFollowEffect } from '@hooks/useGSAPAnimation';
import type { ReactNode } from 'react';
import React from 'react';

interface AnimatedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  enableHover?: boolean;
  enableMouseFollow?: boolean;
  hoverScale?: number;
}

/**
 * 마우스 효과가 적용된 카드 컴포넌트
 * - enableHover: 호버 시 확대 효과
 * - enableMouseFollow: 마우스 따라가기 효과
 */
export function AnimatedCard({
  children,
  enableHover = true,
  enableMouseFollow = false,
  hoverScale = 1.02,
  className,
  ...props
}: AnimatedCardProps) {
  const hoverRef = useHoverScale(enableHover ? hoverScale : 1);
  const mouseFollowRef = useMouseFollowEffect(enableMouseFollow);

  // 두 효과를 동시에 적용하려면 하나의 ref만 사용
  const combinedRef = enableMouseFollow ? mouseFollowRef : enableHover ? hoverRef : null;

  return (
    <div ref={combinedRef} className={className} {...props}>
      {children}
    </div>
  );
}

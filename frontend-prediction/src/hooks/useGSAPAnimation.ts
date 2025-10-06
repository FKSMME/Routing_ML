import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * 마우스 움직임 효과 Hook
 */
export function useMouseFollowEffect(enabled = true) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const element = elementRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      gsap.to(element, {
        x: x * 0.05,
        y: y * 0.05,
        duration: 0.6,
        ease: 'power2.out',
      });
    };

    const handleMouseLeave = () => {
      gsap.to(element, {
        x: 0,
        y: 0,
        duration: 0.8,
        ease: 'elastic.out(1, 0.5)',
      });
    };

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [enabled]);

  return elementRef;
}

/**
 * 박스 등장 애니메이션 Hook
 */
export function useBoxEntrance(delay = 0) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elementRef.current) return;

    gsap.fromTo(
      elementRef.current,
      {
        opacity: 0,
        y: 30,
        scale: 0.9,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        delay,
        ease: 'back.out(1.7)',
      }
    );
  }, [delay]);

  return elementRef;
}

/**
 * 메뉴바 애니메이션 Hook
 */
export function useMenuAnimation() {
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuRef.current) return;

    const items = menuRef.current.querySelectorAll('.main-nav-tab');

    gsap.fromTo(
      items,
      {
        opacity: 0,
        y: -20,
        scale: 0.95,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power3.out',
      }
    );
  }, []);

  return menuRef;
}

/**
 * 호버 효과 강화 Hook
 */
export function useHoverScale(scale = 1.05) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elementRef.current) return;

    const element = elementRef.current;

    const handleMouseEnter = () => {
      gsap.to(element, {
        scale,
        duration: 0.3,
        ease: 'power2.out',
      });
    };

    const handleMouseLeave = () => {
      gsap.to(element, {
        scale: 1,
        duration: 0.3,
        ease: 'power2.out',
      });
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [scale]);

  return elementRef;
}

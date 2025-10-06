import { useCallback } from 'react';
import { analytics } from '@/lib/analytics';

/**
 * Hook for tracking button clicks with analytics
 *
 * @example
 * const handleSave = useTrackedClick('save_button', 'routing_editor', saveToDatabase);
 */
export function useTrackedClick<T extends (...args: any[]) => any>(
  buttonId: string,
  context?: string,
  handler?: T
): T {
  return useCallback(
    ((...args: any[]) => {
      // Track the click
      analytics.trackButtonClick(buttonId, context);

      // Call the original handler
      if (handler) {
        return handler(...args);
      }
    }) as T,
    [buttonId, context, handler]
  );
}

/**
 * Hook for tracking feature usage with timing
 *
 * @example
 * const { start, end } = useFeatureTracking('data_export');
 * start();
 * // ... perform export ...
 * end();
 */
export function useFeatureTracking(featureId: string) {
  let startTime: number | null = null;

  const start = useCallback(() => {
    startTime = Date.now();
    analytics.trackFeatureUsage(featureId, 'start');
  }, [featureId]);

  const end = useCallback(() => {
    const duration = startTime ? Date.now() - startTime : undefined;
    analytics.trackFeatureUsage(featureId, 'end', duration);
    startTime = null;
  }, [featureId]);

  const cancel = useCallback(() => {
    analytics.trackFeatureUsage(featureId, 'cancel');
    startTime = null;
  }, [featureId]);

  return { start, end, cancel };
}

/**
 * Hook for tracking page views
 *
 * @example
 * usePageTracking('routing_editor');
 */
export function usePageTracking(pageName: string) {
  useCallback(() => {
    analytics.trackPageView(pageName);
  }, [pageName]);
}

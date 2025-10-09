/**
 * Analytics Library for UI Usage Tracking
 *
 * Supports:
 * - PostHog (production)
 * - Console logging (development)
 * - LocalStorage fallback (no external service)
 */

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
  timestamp: string;
}

interface ButtonClickEvent {
  button_id: string;
  context?: string;
  screen?: string;
  timestamp: string;
}

interface FeatureUsageEvent {
  feature_id: string;
  action: string;
  duration_ms?: number;
  timestamp: string;
}

class AnalyticsService {
  private enabled: boolean;
  private buffer: AnalyticsEvent[] = [];
  private readonly STORAGE_KEY = 'routing_ml_analytics_buffer';
  private readonly MAX_BUFFER_SIZE = 100;

  constructor() {
    this.enabled = true;
    this.loadBuffer();
  }

  /**
   * Initialize analytics service
   */
  init(): void {
    if (import.meta.env.PROD && import.meta.env.VITE_POSTHOG_KEY) {
      // PostHog will be initialized when available
      console.log('[Analytics] PostHog initialized (placeholder)');
    } else {
      console.log('[Analytics] Running in development mode (console only)');
    }

    // Send buffered events
    this.flushBuffer();
  }

  /**
   * Track generic event
   */
  track(event: string, properties?: Record<string, unknown>): void {
    if (!this.enabled) return;

    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      timestamp: new Date().toISOString(),
    };

    // Log in development
    if (import.meta.env.DEV) {
      console.log('[Analytics]', event, properties);
    }

    // Buffer for later sending
    this.addToBuffer(analyticsEvent);

    // Send to PostHog in production
    if (import.meta.env.PROD && (window as any).posthog) {
      (window as any).posthog.capture(event, properties);
    }
  }

  /**
   * Track button click with context
   */
  trackButtonClick(buttonId: string, context?: string, screen?: string): void {
    const event: ButtonClickEvent = {
      button_id: buttonId,
      context,
      screen,
      timestamp: new Date().toISOString(),
    };

    this.track('button_click', event as unknown as Record<string, unknown>);
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(featureId: string, action: string, durationMs?: number): void {
    const event: FeatureUsageEvent = {
      feature_id: featureId,
      action,
      duration_ms: durationMs,
      timestamp: new Date().toISOString(),
    };

    this.track('feature_usage', event as unknown as Record<string, unknown>);
  }

  /**
   * Track page view
   */
  trackPageView(pageName: string): void {
    this.track('page_view', {
      page_name: pageName,
      url: window.location.pathname,
    });
  }

  /**
   * Track error
   */
  trackError(error: Error, context?: string): void {
    this.track('error', {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack,
      context,
    });
  }

  /**
   * Get analytics summary (for debugging)
   */
  getSummary(): {
    totalEvents: number;
    buttonClicks: number;
    featureUsage: number;
    pageViews: number;
  } {
    const buffer = this.loadBuffer();

    return {
      totalEvents: buffer.length,
      buttonClicks: buffer.filter(e => e.event === 'button_click').length,
      featureUsage: buffer.filter(e => e.event === 'feature_usage').length,
      pageViews: buffer.filter(e => e.event === 'page_view').length,
    };
  }

  /**
   * Export analytics data (for manual analysis)
   */
  exportData(): AnalyticsEvent[] {
    return this.loadBuffer();
  }

  /**
   * Clear all buffered data
   */
  clearData(): void {
    this.buffer = [];
    this.saveBuffer();
  }

  /**
   * Enable/disable tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[Analytics] Tracking ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Private methods

  private addToBuffer(event: AnalyticsEvent): void {
    this.buffer.push(event);

    // Limit buffer size
    if (this.buffer.length > this.MAX_BUFFER_SIZE) {
      this.buffer = this.buffer.slice(-this.MAX_BUFFER_SIZE);
    }

    this.saveBuffer();
  }

  private loadBuffer(): AnalyticsEvent[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.buffer = JSON.parse(stored);
        return this.buffer;
      }
    } catch (error) {
      console.error('[Analytics] Failed to load buffer:', error);
    }
    return [];
  }

  private saveBuffer(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.buffer));
    } catch (error) {
      console.error('[Analytics] Failed to save buffer:', error);
    }
  }

  private flushBuffer(): void {
    // In production with PostHog, send buffered events
    if (import.meta.env.PROD && (window as any).posthog && this.buffer.length > 0) {
      console.log(`[Analytics] Flushing ${this.buffer.length} buffered events`);

      this.buffer.forEach(event => {
        (window as any).posthog.capture(event.event, event.properties);
      });

      // Clear buffer after successful flush
      this.clearData();
    }
  }
}

// Singleton instance
export const analytics = new AnalyticsService();

// Export types
export type { AnalyticsEvent, ButtonClickEvent, FeatureUsageEvent };

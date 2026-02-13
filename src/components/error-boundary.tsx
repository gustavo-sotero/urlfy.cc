// src/components/error-boundary.tsx
'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryMessages {
  somethingWentWrong: string;
  unexpectedError: string;
  retry: string;
}

class ErrorBoundaryImpl extends Component<
  Props & { messages: ErrorBoundaryMessages },
  State
> {
  constructor(props: Props & { messages: ErrorBoundaryMessages }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Send to error tracking service
    if (typeof window !== 'undefined') {
      // Report to window.reportError if available
      if (window.reportError) {
        window.reportError(error);
      }

      // Send to internal monitoring endpoint (fire-and-forget)
      fetch('/api/monitor/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: error.message,
          componentStack: errorInfo.componentStack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      }).catch((fetchError) => {
        // Silently fail - we don't want logging errors to break the app
        console.error('Failed to send error report:', fetchError);
      });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex min-h-100 flex-col items-center justify-center gap-4 p-8 text-center"
          role="alert"
        >
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">
              {this.props.messages.somethingWentWrong}
            </h2>
            <p className="text-muted-foreground">
              {this.state.error?.message ?? this.props.messages.unexpectedError}
            </p>
          </div>
          <Button onClick={this.handleRetry} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            {this.props.messages.retry}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorBoundary(props: Props) {
  const t = useTranslations('Common');

  return (
    <ErrorBoundaryImpl
      {...props}
      messages={{
        somethingWentWrong: t('somethingWentWrong'),
        unexpectedError: t('unexpectedError'),
        retry: t('retry')
      }}
    />
  );
}

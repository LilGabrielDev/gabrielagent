"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, AlertCircle, Info } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorDetails?: {
    code?: string;
    message?: string;
    details?: unknown;
    statusCode?: number;
  };
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const errorDetails = parseErrorMessage(error.message);
    return { hasError: true, error, errorDetails };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorDetails: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <ErrorFallback
          error={this.state.error}
          errorDetails={this.state.errorDetails}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

function parseErrorMessage(message: string): {
  code?: string;
  message?: string;
  details?: unknown;
  statusCode?: number;
} {
  try {
    // Try to parse JSON error response
    const parsed = JSON.parse(message) as {
      error?: {
        code?: string;
        message?: string;
        details?: unknown;
        statusCode?: number;
      };
      code?: string;
      message?: string;
      details?: unknown;
      statusCode?: number;
    };
    if (parsed.error) {
      return {
        code: parsed.error.code,
        message: parsed.error.message,
        details: parsed.error.details,
        statusCode: parsed.error.statusCode,
      };
    }
    return {
      code: parsed.code,
      message: parsed.message,
      details: parsed.details,
      statusCode: parsed.statusCode,
    };
  } catch {
    // If not JSON, return the raw message
    return { message };
  }
}

function getErrorTitle(code?: string, statusCode?: number): string {
  if (statusCode === 401 || code === "UNAUTHORIZED") return "Authentication Required";
  if (statusCode === 403 || code === "FORBIDDEN") return "Access Denied";
  if (statusCode === 404 || code === "NOT_FOUND") return "Not Found";
  if (statusCode === 429 || code === "RATE_LIMIT_EXCEEDED") return "Too Many Requests";
  if (statusCode === 500 || code === "INTERNAL_ERROR") return "Server Error";
  if (statusCode === 503) return "Service Unavailable";
  return "Something went wrong";
}

function ErrorIcon({
  code,
  statusCode,
}: {
  code?: string;
  statusCode?: number;
}) {
  if (statusCode === 401 || code === "UNAUTHORIZED") return <AlertCircle className="h-7 w-7 text-gabriel-danger" />;
  if (statusCode === 403 || code === "FORBIDDEN") return <AlertCircle className="h-7 w-7 text-gabriel-danger" />;
  if (statusCode === 404 || code === "NOT_FOUND") return <Info className="h-7 w-7 text-gabriel-danger" />;
  return <AlertTriangle className="h-7 w-7 text-gabriel-danger" />;
}

interface ErrorFallbackProps {
  error: Error | null;
  errorDetails?: {
    code?: string;
    message?: string;
    details?: unknown;
    statusCode?: number;
  };
  onRetry: () => void;
}

function ErrorFallback({
  error,
  errorDetails,
  onRetry,
}: ErrorFallbackProps) {
  const title = getErrorTitle(errorDetails?.code, errorDetails?.statusCode);
  
  const displayMessage: string =
    typeof errorDetails?.message === "string"
      ? errorDetails.message
      : typeof error?.message === "string"
        ? error.message
        : "An unexpected error occurred. You can try again or return to the dashboard.";
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-gabriel-border bg-gabriel-surface p-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <ErrorIcon code={errorDetails?.code} statusCode={errorDetails?.statusCode} />
          </div>

          <h2 className="text-center text-lg font-semibold text-gabriel-text">
            {title}
          </h2>

          <p className="mt-3 text-center text-sm text-gabriel-text-light">
            {displayMessage}
          </p>

          {errorDetails?.code && (
            <div className="mt-3 rounded bg-gabriel-bg px-3 py-2">
              <p className="text-xs font-mono text-gabriel-text-light">
                Code: <span className="font-semibold">{errorDetails.code}</span>
              </p>
            </div>
          )}

          {isDevelopment && Boolean(errorDetails?.details) && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-gabriel-text-light hover:text-gabriel-text">
                Details (Dev)
              </summary>
              <pre className="mt-2 overflow-auto rounded bg-gabriel-bg p-2 text-xs text-gabriel-text-light">
                {JSON.stringify(errorDetails?.details, null, 2)}
              </pre>
            </details>
          )}

          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-gabriel-border bg-gabriel-surface px-4 py-2 text-sm font-medium text-gabriel-text hover:bg-gabriel-bg transition-colors"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-lg bg-gabriel-primary px-4 py-2 text-sm font-medium text-white hover:bg-gabriel-primary-dark transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

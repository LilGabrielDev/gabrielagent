/**
 * API Error Handling Utility
 * Provides consistent error parsing and formatting across the application
 */

export interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    statusCode?: number;
    requestId?: string;
  };
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
    public requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
        requestId: this.requestId,
      },
    };
  }
}

/**
 * Parse a fetch response and throw an ApiError if not ok
 */
export async function handleApiResponse<T>(
  response: Response,
  requestId?: string
): Promise<T> {
  const contentType = response.headers.get("content-type");
  let data: unknown;

  try {
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorData = data as ApiErrorResponse | null;
    const error = errorData?.error;

    throw new ApiError(
      response.status,
      error?.code || getErrorCode(response.status),
      error?.message || getErrorMessage(response.status),
      error?.details,
      error?.requestId || requestId
    );
  }

  return data as T;
}

/**
 * Make an API call with automatic error handling
 */
export async function apiCall<T>(
  url: string,
  options?: RequestInit,
  requestId?: string
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    return await handleApiResponse<T>(response, requestId);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network or parsing error
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      error instanceof Error ? error.message : "Network request failed",
      undefined,
      requestId
    );
  }
}

/**
 * Get user-friendly error message based on status code
 */
function getErrorMessage(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "Invalid request. Please check your input and try again.";
    case 401:
      return "Authentication required. Please log in again.";
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return "The requested resource was not found.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    case 500:
      return "Server error. Please try again later.";
    case 502:
      return "Bad gateway. The server is temporarily unavailable.";
    case 503:
      return "Service unavailable. Please try again later.";
    case 504:
      return "Gateway timeout. The server took too long to respond.";
    default:
      return "An unexpected error occurred. Please try again.";
  }
}

/**
 * Get error code based on status code
 */
function getErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "VALIDATION_ERROR";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 429:
      return "RATE_LIMIT_EXCEEDED";
    case 500:
      return "INTERNAL_ERROR";
    case 502:
      return "BAD_GATEWAY";
    case 503:
      return "SERVICE_UNAVAILABLE";
    case 504:
      return "GATEWAY_TIMEOUT";
    default:
      return "UNKNOWN_ERROR";
  }
}

/**
 * Format an error for display to the user
 */
export function formatErrorForDisplay(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Extract error details for logging
 */
export function extractErrorDetails(error: unknown): {
  code: string;
  message: string;
  statusCode?: number;
  details?: unknown;
} {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      code: "UNKNOWN_ERROR",
      message: error.message,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: String(error),
  };
}

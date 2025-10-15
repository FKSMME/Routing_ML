/**
 * 공통 에러 처리 유틸리티
 *
 * API 에러를 파싱하고 사용자 친화적인 메시지로 변환합니다.
 */

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

export interface ErrorHandlerOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  fallbackMessage?: string;
}

/**
 * API 에러 응답을 파싱합니다.
 */
export async function parseApiError(response: Response): Promise<ApiError> {
  const status = response.status;
  let message = `HTTP ${status}: ${response.statusText}`;
  let code: string | undefined;
  let details: unknown;

  try {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const body = await response.json();

      // FastAPI 표준 에러 형식
      if (body.detail) {
        if (typeof body.detail === "string") {
          message = body.detail;
        } else if (Array.isArray(body.detail)) {
          // Pydantic 유효성 검증 에러
          const errors = body.detail.map((err: any) =>
            `${err.loc?.join(".")}: ${err.msg}`
          ).join(", ");
          message = `유효성 검증 실패: ${errors}`;
          details = body.detail;
        } else if (typeof body.detail === "object") {
          message = body.detail.message || JSON.stringify(body.detail);
          code = body.detail.code;
          details = body.detail;
        }
      }

      // 기타 에러 형식
      if (body.message) {
        message = body.message;
      }
      if (body.code) {
        code = body.code;
      }
      if (body.error) {
        message = body.error;
      }
    } else {
      // JSON이 아닌 경우 텍스트로 파싱
      const text = await response.text();
      if (text) {
        message = text;
      }
    }
  } catch (parseError) {
    // 파싱 실패 시 기본 메시지 사용
    console.error("Failed to parse error response:", parseError);
  }

  return {
    message,
    status,
    code,
    details,
  };
}

/**
 * 네트워크 에러를 처리합니다.
 */
export function handleNetworkError(error: unknown): ApiError {
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return {
      message: "네트워크 연결을 확인해주세요. 서버에 접속할 수 없습니다.",
      code: "NETWORK_ERROR",
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: "UNKNOWN_ERROR",
    };
  }

  return {
    message: "알 수 없는 에러가 발생했습니다.",
    code: "UNKNOWN_ERROR",
    details: error,
  };
}

/**
 * HTTP 상태 코드에 따라 사용자 친화적인 메시지를 반환합니다.
 */
export function getStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return "요청이 올바르지 않습니다.";
    case 401:
      return "인증이 필요합니다. 다시 로그인해주세요.";
    case 403:
      return "이 작업을 수행할 권한이 없습니다.";
    case 404:
      return "요청한 리소스를 찾을 수 없습니다.";
    case 409:
      return "리소스 충돌이 발생했습니다. (중복되거나 버전이 맞지 않습니다)";
    case 422:
      return "입력 데이터의 형식이 올바르지 않습니다.";
    case 429:
      return "너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.";
    case 500:
      return "서버 내부 오류가 발생했습니다.";
    case 502:
      return "게이트웨이 오류가 발생했습니다.";
    case 503:
      return "서비스를 일시적으로 사용할 수 없습니다.";
    case 504:
      return "게이트웨이 시간 초과가 발생했습니다.";
    default:
      return `HTTP ${status} 에러가 발생했습니다.`;
  }
}

/**
 * API 에러를 처리하고 사용자에게 알립니다.
 */
export function handleApiError(
  error: ApiError,
  options: ErrorHandlerOptions = {}
): void {
  const {
    showToast = true,
    logToConsole = true,
    fallbackMessage = "작업을 수행하는 중 에러가 발생했습니다.",
  } = options;

  const displayMessage = error.message || fallbackMessage;

  if (logToConsole) {
    console.error("API Error:", {
      message: error.message,
      status: error.status,
      code: error.code,
      details: error.details,
    });
  }

  if (showToast) {
    // Toast 시스템이 구현되면 여기서 호출
    // showToast({ type: "error", message: displayMessage });
    console.error(`[Toast would show] ${displayMessage}`);
  }
}

/**
 * Fetch 요청을 래핑하여 에러를 자동으로 처리합니다.
 */
export async function fetchWithErrorHandling(
  url: string,
  options?: RequestInit,
  errorOptions?: ErrorHandlerOptions
): Promise<Response> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const apiError = await parseApiError(response);
      handleApiError(apiError, errorOptions);
      throw apiError;
    }

    return response;
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) {
      // 이미 parseApiError에서 처리된 에러
      throw error;
    }

    // 네트워크 에러 등
    const networkError = handleNetworkError(error);
    handleApiError(networkError, errorOptions);
    throw networkError;
  }
}

/**
 * 재시도 로직을 포함한 Fetch 요청
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<Response> {
  let lastError: ApiError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const apiError = await parseApiError(response);

        // 재시도 가능한 상태 코드
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        if (attempt < maxRetries && retryableStatuses.includes(response.status)) {
          console.warn(`Retrying request (${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
          continue;
        }

        throw apiError;
      }

      return response;
    } catch (error) {
      if (error && typeof error === "object" && "status" in error) {
        lastError = error as ApiError;
      } else {
        lastError = handleNetworkError(error);
      }

      if (attempt < maxRetries) {
        console.warn(`Retrying request (${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }

  if (lastError) {
    handleApiError(lastError);
    throw lastError;
  }

  throw new Error("Unexpected error in fetchWithRetry");
}

import { tokenStorage } from "../auth/storage"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api"

export { API_BASE_URL }
let unauthorizedHandler: (() => void) | null = null

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown
  auth?: boolean
}

function toReadableFieldName(value: string) {
  const withSpaces = value.replace(/[_-]+/g, " ")
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)
}

function formatApiErrorMessage(payload: unknown, status: number) {
  const detail = (payload as { detail?: unknown } | null)?.detail

  if (typeof detail === "string" && detail.trim()) {
    return detail
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object") return null
        const message = (item as { msg?: unknown }).msg
        if (typeof message !== "string" || !message.trim()) return null

        const loc = (item as { loc?: unknown }).loc
        if (!Array.isArray(loc)) return message

        const fieldPath = loc
          .filter((part) => typeof part === "string")
          .filter((part) => part !== "body" && part !== "query" && part !== "path" && part !== "header")
          .map((part) => toReadableFieldName(part))
          .join(" > ")

        return fieldPath ? `${fieldPath}: ${message}` : message
      })
      .filter((item): item is string => Boolean(item))

    if (messages.length > 0) {
      return messages.join(" | ")
    }
  }

  return `Request failed (${status})`
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = false, headers, body, ...rest } = options
  const requestHeaders = new Headers(headers)

  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json")
  }

  if (auth) {
    const token = tokenStorage.get()
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`)
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const responseContentType = response.headers.get("content-type") ?? ""
  const isJson = responseContentType.includes("application/json")
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    const message = formatApiErrorMessage(payload, response.status)

    if (response.status === 401) {
      tokenStorage.clear()
      unauthorizedHandler?.()
    }

    throw new ApiError(message, response.status)
  }

  return payload as T
}

/** Multipart upload helper. Lets the browser set the multipart boundary. */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options: { auth?: boolean } = {},
): Promise<T> {
  const { auth = false } = options
  const requestHeaders = new Headers()

  if (auth) {
    const token = tokenStorage.get()
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`)
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: requestHeaders,
    body: formData,
  })

  const responseContentType = response.headers.get("content-type") ?? ""
  const isJson = responseContentType.includes("application/json")
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    const message = formatApiErrorMessage(payload, response.status)
    if (response.status === 401) {
      tokenStorage.clear()
      unauthorizedHandler?.()
    }
    throw new ApiError(message, response.status)
  }

  return payload as T
}

/** Fetch an authenticated binary resource and return an object URL. */
export async function apiFetchBlobUrl(path: string): Promise<string> {
  const requestHeaders = new Headers()
  const token = tokenStorage.get()
  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { headers: requestHeaders })
  if (!response.ok) {
    if (response.status === 401) {
      tokenStorage.clear()
      unauthorizedHandler?.()
    }
    throw new ApiError(`Request failed (${response.status})`, response.status)
  }

  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

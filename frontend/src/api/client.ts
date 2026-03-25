import { tokenStorage } from "../auth/storage"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001"
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
    const detail = payload?.detail
    const message = typeof detail === "string" ? detail : `Request failed (${response.status})`

    if (response.status === 401) {
      tokenStorage.clear()
      unauthorizedHandler?.()
    }

    throw new ApiError(message, response.status)
  }

  return payload as T
}

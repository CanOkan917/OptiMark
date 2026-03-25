import type {AuthTokenResponse, LoginRequest, RegisterRequest, User, UserRole} from "../types/auth"
import {apiRequest} from "./client"

export function login(payload: LoginRequest) {
    return apiRequest<AuthTokenResponse>("/auth/login", {
        method: "POST",
        body: payload,
    })
}

export function me() {
    return apiRequest<User>("/auth/me", {
        method: "GET",
        auth: true,
    })
}

export function adminCreateUser(payload: RegisterRequest, role: UserRole) {
    return apiRequest<User>(`/admin/users?role=${encodeURIComponent(role)}`, {
        method: "POST",
        auth: true,
        body: payload,
    })
}

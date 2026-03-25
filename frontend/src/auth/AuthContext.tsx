import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from "react"
import * as authApi from "../api/auth"
import {ApiError, setUnauthorizedHandler} from "../api/client"
import type {LoginRequest, User} from "../types/auth"
import {tokenStorage} from "./storage"

interface AuthContextValue {
    user: User | null
    token: string | null
    isInitializing: boolean
    isAuthenticated: boolean
    login: (payload: LoginRequest) => Promise<void>
    logout: () => void
    refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({children}: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(tokenStorage.get())
    const [user, setUser] = useState<User | null>(null)
    const [isInitializing, setIsInitializing] = useState(true)

    const logout = useCallback(() => {
        tokenStorage.clear()
        setToken(null)
        setUser(null)
    }, [])

    const refreshMe = useCallback(async () => {
        try {
            const currentUser = await authApi.me()
            setUser(currentUser)
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                logout()
            }
            throw error
        }
    }, [logout])

    const login = useCallback(
        async (payload: LoginRequest) => {
            const response = await authApi.login(payload)
            tokenStorage.set(response.access_token)
            setToken(response.access_token)
            await refreshMe()
        },
        [refreshMe],
    )

    useEffect(() => {
        setUnauthorizedHandler(logout)
        return () => setUnauthorizedHandler(null)
    }, [logout])

    useEffect(() => {
        const init = async () => {
            const storedToken = tokenStorage.get()
            if (!storedToken) {
                setIsInitializing(false)
                return
            }

            try {
                await refreshMe()
            } catch {
                // On 401 and other auth failures, the user is logged out.
            } finally {
                setIsInitializing(false)
            }
        }

        void init()
    }, [refreshMe])

    useEffect(() => {
        if (!token) {
            setUser(null)
        }
    }, [token])

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            token,
            isInitializing,
            isAuthenticated: Boolean(token && user),
            login,
            logout,
            refreshMe,
        }),
        [isInitializing, login, logout, refreshMe, token, user],
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider")
    }
    return context
}

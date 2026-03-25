import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../auth/AuthContext"

export function ProtectedRoute() {
  const { isInitializing, isAuthenticated } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        Checking session...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

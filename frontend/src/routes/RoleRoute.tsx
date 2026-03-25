import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../auth/AuthContext"
import type { UserRole } from "../types/auth"

interface RoleRouteProps {
  allowedRoles: UserRole[]
}

export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />
  }

  return <Outlet />
}

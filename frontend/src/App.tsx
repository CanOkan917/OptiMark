import {Navigate, Route, Routes} from "react-router-dom"
import {useAuth} from "./auth/AuthContext"
import {DashboardPage} from "./pages/DashboardPage"
import {CourseManagementPage} from "./pages/CourseManagementPage"
import {DashboardSectionPlaceholderPage} from "./pages/DashboardSectionPlaceholderPage"
import {DashboardSummaryPage} from "./pages/DashboardSummaryPage"
import {ExamManagementPage} from "./pages/ExamManagementPage"
import {ForbiddenPage} from "./pages/ForbiddenPage"
import {LoginPage} from "./pages/LoginPage"
import {DashboardLayout} from "./layouts/DashboardLayout"
import {ProtectedRoute} from "./routes/ProtectedRoute"
import {RoleRoute} from "./routes/RoleRoute"
import {ScanQueuePage} from "./pages/ScanQueuePage.tsx"

function NotFoundRedirect() {
    const {isAuthenticated} = useAuth()
    return <Navigate to={isAuthenticated ? "/dashboard" : "/"} replace/>
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<LoginPage/>}/>
            <Route path="/login" element={<LoginPage/>}/>
            <Route path="/forbidden" element={<ForbiddenPage/>}/>

            <Route element={<ProtectedRoute/>}>
                <Route path="/dashboard" element={<DashboardLayout/>}>
                    <Route index element={<DashboardPage/>}/>
                    <Route
                        path="scans"
                        element={<ScanQueuePage />}
                    />
                    <Route
                        path="reports"
                        element={<DashboardSectionPlaceholderPage title="Reports"
                                                                  description="Review and export generated exam reports."/>}
                    />
                    <Route
                        path="courses"
                        element={<CourseManagementPage/>}
                    />
                    <Route
                        path="exams"
                        element={<ExamManagementPage/>}
                    />
                    <Route
                        path="students"
                        element={<DashboardSectionPlaceholderPage title="Students"
                                                                  description="Browse and manage student records."/>}
                    />
                    <Route
                        path="settings"
                        element={<DashboardSectionPlaceholderPage title="Settings"
                                                                  description="Configure workspace and account preferences."/>}
                    />
                    <Route element={<RoleRoute allowedRoles={["admin", "school_admin", "analyst"]}/>}>
                        <Route path="summary" element={<DashboardSummaryPage/>}/>
                    </Route>
                </Route>
            </Route>

            <Route path="*" element={<NotFoundRedirect/>}/>
        </Routes>
    )
}

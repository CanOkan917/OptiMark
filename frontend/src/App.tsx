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
import {ExamBuilderPage} from "./pages/ExamBuilderPage.tsx";
import {ExamPublishSettingsPage} from "./pages/ExamPublishSettingsPage.tsx";
import {StudentsPage} from "./pages/StudentsPage.tsx";
import {StudentImportPage} from "./pages/StudentImportPage.tsx";
import {StudentGroupsPage} from "./pages/StudentGroupsPage.tsx";
import {StudentGroupDetailPage} from "./pages/StudentGroupDetailPage.tsx";
import {StudentDetailPage} from "./pages/StudentDetailPage.tsx";
import {StudentEditPage} from "./pages/StudentEditPage.tsx";
import {StudentGroupFormPage} from "./pages/StudentGroupFormPage.tsx";
import {StudentsMockProvider} from "./students/StudentsMockContext.tsx";
import {ExamOverviewPage} from "./pages/ExamOverviewPage.tsx";

function NotFoundRedirect() {
    const {isAuthenticated} = useAuth()
    return <Navigate to={isAuthenticated ? "/dashboard" : "/"} replace/>
}

export default function App() {
    return (
        <StudentsMockProvider>
            <Routes>
                <Route path="/" element={<LoginPage/>}/>
                <Route path="/login" element={<LoginPage/>}/>
                <Route path="/forbidden" element={<ForbiddenPage/>}/>

                <Route element={<ProtectedRoute/>}>
                    <Route path="/dashboard" element={<DashboardLayout/>}>
                        <Route index element={<DashboardPage/>}/>
                        <Route
                            path="scans"
                            element={<ScanQueuePage/>}
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
                            path="exams/:id/builder"
                            element={<ExamBuilderPage/>}
                        />
                        <Route
                            path="exams/:id"
                            element={<ExamOverviewPage/>}
                        />
                        <Route
                            path="exams/:id/publish"
                            element={<ExamPublishSettingsPage/>}
                        />
                        <Route
                            path="students"
                            element={<StudentsPage/>}
                        />
                        <Route
                            path="students/import"
                            element={<StudentImportPage/>}
                        />
                        <Route
                            path="students/groups"
                            element={<StudentGroupsPage/>}
                        />
                        <Route
                            path="students/groups/new"
                            element={<StudentGroupFormPage/>}
                        />
                        <Route
                            path="students/groups/:groupId"
                            element={<StudentGroupDetailPage/>}
                        />
                        <Route
                            path="students/groups/:groupId/edit"
                            element={<StudentGroupFormPage/>}
                        />
                        <Route
                            path="students/:studentId"
                            element={<StudentDetailPage/>}
                        />
                        <Route
                            path="students/:studentId/edit"
                            element={<StudentEditPage/>}
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
        </StudentsMockProvider>
    )
}

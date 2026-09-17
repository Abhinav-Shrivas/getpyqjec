import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import DownloadPage from "./components/DownloadPage/DownloadPage";
import RootLayout from "./components/Root/Root";
import LoginForm, { action as loginAction } from "./components/LoginForm/LoginForm";
import ErrorPage from "./components/ErrorPage/Error";
import { AuthProvider } from "./store/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";

const UploadDataPage = lazy(() => import("./components/UploadPage/UploadPage"));
const ForgotPassword = lazy(() => import("./components/ForgotPassword/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/ResetPassword/ResetPassword"));

const PageFallback = () => <div style={{ minHeight: "60vh" }}></div>;

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <DownloadPage />, errorElement: <ErrorPage /> },
      {
        path: "upload",
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageFallback />}>
              <UploadDataPage />
            </Suspense>
          </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: "profile",
        action: loginAction,
        element: <LoginForm />,
        errorElement: <ErrorPage />,
      },
      {
        path: "*",
        element: <ErrorPage message="Page not found" status={404} />,
      },
      {
        path: "forgot-password",
        element: (
          <Suspense fallback={<PageFallback />}>
            <ForgotPassword />
          </Suspense>
        ),
        errorElement: <ErrorPage />,
      },
      {
        path: "reset-password/:uid/:token",
        element: (
          <Suspense fallback={<PageFallback />}>
            <ResetPassword />
          </Suspense>
        ),
        errorElement: <ErrorPage />,
      },
    ],
  },
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router}></RouterProvider>
    </AuthProvider>
  );
}

export default App;

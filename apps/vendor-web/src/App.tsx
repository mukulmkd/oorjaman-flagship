import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { RequireApprovedVendor } from "./components/RequireApprovedVendor";
import { RequireSession } from "@oorjaman/web-ui";
import { RequireVendorRole } from "./components/RequireVendorRole";
import { VendorLayout } from "./layouts/VendorLayout";
import VendorDashboardPage from "./pages/VendorDashboardPage";
import VendorLoginPage from "./pages/VendorLoginPage";
import VendorPortalPage from "./pages/VendorPortalPage";
import VendorSignupPage from "./pages/VendorSignupPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<VendorLoginPage />} />
      <Route path="/signup" element={<VendorSignupPage />} />
      <Route path="/vendor-login" element={<Navigate to="/login" replace />} />
      <Route path="/vendor-signup" element={<Navigate to="/signup" replace />} />
      <Route
        path="/"
        element={
          <RequireSession loginPath="/login">
            <RequireVendorRole>
              <VendorLayout />
            </RequireVendorRole>
          </RequireSession>
        }
      >
        <Route index element={<VendorPortalPage />} />
        <Route path="dashboard" element={<Navigate to="/dashboard/overview" replace />} />
        <Route
          path="dashboard/:tab"
          element={
            <RequireApprovedVendor>
              <VendorDashboardPage />
            </RequireApprovedVendor>
          }
        />
      </Route>
      <Route path="/vendor" element={<Navigate to="/" replace />} />
      <Route path="/vendor/dashboard/:tab" element={<LegacyVendorDashboardRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LegacyVendorDashboardRedirect() {
  const { tab } = useParams<{ tab: string }>();
  return <Navigate to={`/dashboard/${tab ?? "overview"}`} replace />;
}

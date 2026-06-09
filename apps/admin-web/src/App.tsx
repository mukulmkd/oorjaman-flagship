import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAdminRole } from "./components/RequireAdminRole";
import { RequireSession } from "./components/RequireSession";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { VendorDetailPage } from "./pages/VendorDetailPage";
import { VendorIntakeDetailPage } from "./pages/VendorIntakeDetailPage";
import { VendorListPage } from "./pages/VendorListPage";
import { VendorApprovalPage } from "./pages/VendorApprovalPage";
import { TechnicianDirectoryPage } from "./pages/TechnicianVerificationPage";
import { TechnicianDetailPage } from "./pages/TechnicianDetailPage";
import { BookingRoutingPage } from "./pages/BookingRoutingPage";
import { BookingMonitoringPage } from "./pages/BookingMonitoringPage";
import { OperationsDeskPage } from "./pages/OperationsDeskPage";
import { PartnerQualityPage } from "./pages/PartnerQualityPage";
import { TrustSafetyPage } from "./pages/TrustSafetyPage";
import { NotificationTemplatesPage } from "./pages/NotificationTemplatesPage";
import { SubscriptionRenewalsPage } from "./pages/SubscriptionRenewalsPage";
import { PricingManagementPage } from "./pages/PricingManagementPage";
import { ServiceCapacityPricingPage } from "./pages/ServiceCapacityPricingPage";
import { AnalyticsDashboardPage } from "./pages/AnalyticsDashboardPage";
import { FeatureManagementPage } from "./pages/FeatureManagementPage";
import { AmcContractsPage } from "./pages/AmcContractsPage";
import { FinanceSettlementsPage } from "./pages/FinanceSettlementsPage";
import AdminLoginPage from "./pages/AdminLoginPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard/operations" replace />} />
      <Route
        path="/dashboard"
        element={
          <RequireSession>
            <RequireAdminRole>
              <DashboardLayout />
            </RequireAdminRole>
          </RequireSession>
        }
      >
        <Route index element={<Navigate to="operations" replace />} />
        <Route path="analytics" element={<AnalyticsDashboardPage />} />
        <Route path="vendor-approval" element={<VendorApprovalPage />} />
        <Route path="vendor-registration" element={<Navigate to="/dashboard/vendor-approval" replace />} />
        <Route path="technicians" element={<TechnicianDirectoryPage />} />
        <Route path="technicians/item/:technicianId" element={<TechnicianDetailPage />} />
        <Route path="vendors/intake/:intakeId" element={<VendorIntakeDetailPage />} />
        <Route path="vendors/item/:vendorId" element={<VendorDetailPage />} />
        <Route path="vendors/:tab" element={<VendorListPage />} />
        <Route path="booking-routing" element={<BookingRoutingPage />} />
        <Route path="operations" element={<OperationsDeskPage />} />
        <Route path="partners/quality" element={<PartnerQualityPage />} />
        <Route path="trust-safety" element={<TrustSafetyPage />} />
        <Route path="notifications" element={<NotificationTemplatesPage />} />
        <Route path="feature-management" element={<FeatureManagementPage />} />
        <Route path="subscription-renewals" element={<SubscriptionRenewalsPage />} />
        <Route path="bookings" element={<BookingMonitoringPage />} />
        <Route path="support" element={<Navigate to="/dashboard/operations" replace />} />
        <Route path="pricing" element={<PricingManagementPage />} />
        <Route path="service-pricing" element={<ServiceCapacityPricingPage />} />
        <Route path="finance" element={<FinanceSettlementsPage />} />
        <Route path="finance/amc-contracts" element={<AmcContractsPage />} />
        <Route path="finance/amc-wallets" element={<Navigate to="/dashboard/finance/amc-contracts" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard/operations" replace />} />
    </Routes>
  );
}

import { Navigate, Route, Routes } from "react-router-dom";
import { RequireSupportDeskRole } from "./components/RequireSupportDeskRole";
import { RequireSession } from "@oorjaman/web-ui";
import { SupportLayout } from "./layouts/SupportLayout";
import { SupportInboxPage } from "./pages/SupportInboxPage";
import { SupportInsightsPage } from "./pages/SupportInsightsPage";
import { SupportSearchPage } from "./pages/SupportSearchPage";
import SupportLoginPage from "./pages/SupportLoginPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<SupportLoginPage />} />
      <Route
        path="/"
        element={
          <RequireSession loginPath="/login">
            <RequireSupportDeskRole>
              <SupportLayout />
            </RequireSupportDeskRole>
          </RequireSession>
        }
      >
        <Route index element={<Navigate to="/insights" replace />} />
        <Route path="insights" element={<SupportInsightsPage />} />
        <Route path="inbox" element={<SupportInboxPage />} />
        <Route path="search" element={<SupportSearchPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/insights" replace />} />
    </Routes>
  );
}

import { Card } from "@oorjaman/web-ui";

export function VendorCommunicationTab() {
  return (
    <div className="vd-stack">
      <Card padded>
        <h3 className="vd-subtitle">In-app inbox</h3>
        <p className="vd-note">
          Placeholder: threaded messages with operations and customers will appear here (Supabase Realtime or email
          bridge). No inbox backend is wired yet.
        </p>
      </Card>
      <Card padded>
        <h3 className="vd-subtitle">Automated alerts</h3>
        <ul className="vd-list">
          <li>New paid booking assigned to your team - email/SMS/push when dispatch rules are configured.</li>
          <li>Vendor approval / rejection - console placeholder logs today; swap for push later.</li>
          <li>Payout & settlement notices - when finance connects settlement runs.</li>
        </ul>
      </Card>
    </div>
  );
}

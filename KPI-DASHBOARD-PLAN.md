# KPIs menu plan

National Admin scorecard in the Admin portal, compared with the OorjaMan KPI Dashboard and OKR Framework.

National Admin is the `admin` role. State desks (`state_ops`) do not see this menu. The page is `/dashboard/kpis`.

Analytics stays the trend view. Finance stays the money ledger. KPIs is the weekly operating scorecard: the selected week beside the week before it. Weeks run Monday to Sunday, India time. The current week is the latest that can be opened. Each figure opens the existing list.

No database migration was added. The page reads bookings, visit reports, partners, and technicians that are already stored. A summary view was left out so the mobile apps are not exposed to a schema change. If one of those tables passes 20,000 rows, the page says the totals are incomplete.

## Status

Built on the KPIs page:

| KPI | What it counts |
| --- | --- |
| Confirmed bookings | Created in the week and no longer waiting for payment. Cancelled bookings are excluded. |
| Completed visit value | Customer price of visits that finished in the week. This is separate from the platform fee on Finance. |
| Repeat visit rate | Customers who finished a visit in the week and had already finished an earlier one. |
| Post-visit rating | Average customer rating on visit reports finished in the week. |
| Safety checklist | Finished visits whose report has every pre-start safety acknowledgement. |
| Before and after photos | Finished visits with at least one before photo and one after photo. |
| Completion rate | Bookings created in the week that the partner accepted, and that are now completed. |
| Partners approved | Partners whose approval date falls in the week. |
| Partners activated | Partners whose first finished visit falls in the week. |
| Technicians verified | Technicians marked verified in the week. This is the review record, not a training exam. |
| Jobs per technician | Finished visits with an assigned technician, divided by technicians who finished at least one. |
| Acceptance rate | Bookings created in the week that reached a partner, and that the partner then accepted. |

Parked. These are not on the page:

| Item | Why it waits |
| --- | --- |
| Booking conversion | There is no enquiry to divide by. |
| Complaints | Anomaly notes, visit feedback, and support chats are still separate. |
| Vendor cancellation rate | Cancelled visits can be told apart in metadata, and the rate is not defined against accepted bookings. |
| No-show rate | A missed visit is stored only as cancelled. |
| Issue resolution time | Support chats have a close time. Visit issues on the operations desk do not. |
| Green, amber, red | Needs a stored target per KPI. |
| Weekly review | Actual versus target, top movements, root cause, owner, and due date need a review log. |
| Training assessments, SOPs, and a risk register | Not stored in the portal. |

## Original fit

This is the comparison made before the page existed. The built rows above replace the “computable” and the weekly slices of the “partial” rows. The parked table is unchanged in substance.

| KPI | Dimension | Fit before the page | What the portal already did |
| --- | --- | --- | --- |
| Bookings | Growth | Partial | Analytics counted every booking as a lifetime total and a trend. |
| Booking conversion | Growth | Not in the product | No enquiry or lead record. |
| GMV / revenue | Revenue | Partial | Finance and Analytics showed the platform fee and customer collections. |
| Repeat booking rate | Customer | Computable | Bookings stored the customer. No screen counted a second visit. |
| CSAT | Customer | Partial | Visit reports stored a rating. Trust & safety moderated the text. |
| Complaints | Customer | Not a single count | Anomaly notes, visit feedback, and support chats were separate. |
| Vendors onboarded | Vendor | Computable | Vendor approval was a queue, not a weekly count. |
| Vendor activation | Vendor | Computable | A partner’s first completed visit could be derived. |
| Acceptance rate | Vendor | Partial | Stored per partner. Analytics showed it on hover for the top 10. |
| Cancellation rate | Vendor | Partial | Cancellations were stored, with no vendor-cancellation rate. |
| Technicians certified | Technician | Proxy only | Verification status exists. There is no training exam. |
| Jobs per technician | Technician | Computable | Job counts existed per technician. |
| Safety compliance | Technician | Computable | Visit reports stored the pre-start checklist and photos. |
| Completion rate | Operations | Partial | Stored per partner. No national rate. |
| No-show rate | Operations | Not measurable | A former no-show status was folded into cancelled. |
| Issue resolution time | Operations | Partial | Support chats store open and resolved times. The operations inbox does not. |

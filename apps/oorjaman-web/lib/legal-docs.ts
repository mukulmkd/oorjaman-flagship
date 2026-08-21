/**
 * Marketing-site legal documents.
 * Privacy & Data Protection Policy aligned to counsel draft (August 2026).
 * Keep copy aligned with real product flows (customer/technician apps, vendor portal)
 * and Indian marketplace / DPDP expectations. Not a substitute for counsel review.
 */

import {
  COMPANY_ADDRESS,
  COMPANY_LEGAL_NAME,
  GRIEVANCE_EMAIL,
  grievanceOfficerLabel,
  LEGAL_EMAIL,
  PRIVACY_EMAIL,
  SUPPORT_EMAIL,
} from "./site";

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  slug: string;
  title: string;
  description: string;
  lastUpdated: string;
  sections: LegalSection[];
};

const LAST_UPDATED = "2026-08-22";

/** Footer “Legal” column - mandatory public links (order matters). */
export const footerLegalSlugs = [
  "privacy-policy",
  "data-storage",
  "terms-of-service",
  "refund-cancellation",
  "grievance-redressal",
  "app-permissions",
  "service-disclaimers",
  "account-deletion",
  "cookie-policy",
] as const;

export const legalDocuments: LegalDocument[] = [
  {
    slug: "privacy-policy",
    title: "Privacy & Data Protection Policy",
    description:
      "How OorjaMan collects, uses, stores, shares, and protects personal data when you use the website, apps, partner portal, and related services.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "introduction",
        title: "Introduction",
        paragraphs: [
          `OorjaMan (“OorjaMan”, “we”, “us”, or “our”) is a technology-enabled solar rooftop care platform operated by ${COMPANY_LEGAL_NAME} that connects solar asset owners and property owners with independent service partners and trained technicians for solar panel cleaning, preventive maintenance, after-sales support, and related services.`,
          "This Privacy & Data Protection Policy (“Policy”) explains how we collect, use, store, share, protect, and otherwise process personal data when you use our website, customer mobile application, technician mobile application, partner portal, communication channels, and related services (collectively, the “Platform”).",
          "By accessing or using the Platform, you acknowledge that you have read and understood this Policy. Where applicable law requires your consent for a particular processing activity, we will obtain such consent through an appropriate mechanism.",
          `Registered office: ${COMPANY_ADDRESS}. Privacy: ${PRIVACY_EMAIL}. Support: ${SUPPORT_EMAIL}. Formal grievances: /legal/grievance-redressal.`,
        ],
      },
      {
        id: "scope",
        title: "1. Scope of this Policy",
        paragraphs: [
          "This Policy applies to personal data collected through the OorjaMan website; customer mobile application; technician mobile application; partner portal; booking, payment, and service workflows; customer support and communication channels; service visits and related evidence collection; and other OorjaMan-operated digital services that refer to this Policy.",
          "This Policy does not necessarily apply to third-party websites, applications, payment services, map services, or other external services accessed through links or integrations from our Platform. Those parties may have their own privacy policies and terms.",
        ],
      },
      {
        id: "role",
        title: "2. Our role in data processing",
        paragraphs: [
          `For customer accounts and the personal data necessary to operate the Platform, ${COMPANY_LEGAL_NAME} acts as the entity responsible for determining the purposes and means of processing personal data, subject to applicable law (including, as applicable, as Data Fiduciary under the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025).`,
          "We may engage third-party service providers and infrastructure providers to process personal data on our behalf. These may include cloud hosting, database, authentication, storage, mapping, notification, payment, and technical service providers.",
          "Independent service partners and technicians may receive limited customer and service information necessary to perform an assigned booking. They must use such information only for legitimate service purposes and in accordance with applicable contractual and legal requirements.",
          "Partners are independent businesses and are responsible for their own personnel, technician conduct, safety compliance, insurance where required, and quality of on-site services.",
        ],
      },
      {
        id: "data-we-collect",
        title: "3. Personal data we collect",
        paragraphs: [
          "We collect only information reasonably necessary to provide, manage, secure, and improve the Platform and our services.",
        ],
        bullets: [
          "Account: name; mobile/phone number; email; credentials and authentication information; user role (customer, technician, partner, or support); profile information; account status and preferences. Partner / technician onboarding may also include KYC-style documents and bank details under stricter access controls.",
          "Property and solar site: service/property address; rooftop details; plant/system capacity; panel and equipment information; site access; service instructions and notes; photographs uploaded by customers or technicians; before-and-after photographs; other evidence required to confirm completion.",
          "Location and GPS (where you grant device permission): capturing or confirming a service address; helping technicians navigate; dispatch and allocation; live visit tracking during active jobs; confirming attendance; improving safety and operational efficiency. Live location for an active visit is intended for that visit, not unrestricted continuous tracking. You may withdraw location permission in device settings; navigation and visit tracking may then be unavailable.",
          "Booking and payment: booking history; service type; appointment date and time; pricing; platform fees; surcharges; cancellation records; payment status; refunds; settlements; transaction references. Full card or other sensitive payment credentials may be collected by the payment provider rather than stored by OorjaMan, depending on the integration.",
          "Communications and support: in-app chats; customer service communications; service-related messages; complaints and feedback; notification preferences; records of support interactions. We may review relevant metadata and, where reasonably necessary, communications themselves to investigate complaints, fraud, abuse, safety issues, or Terms violations.",
          "Device and technical: device type; operating system; application version; push notification token; authentication/session information; diagnostic logs; crash and error information; technical performance information.",
        ],
      },
      {
        id: "how-we-collect",
        title: "4. How we collect personal data",
        paragraphs: [
          "We may collect personal data directly when you create an account or update your profile; when you book; during scheduling and execution; when you upload photographs or documents; through GPS/location permissions; through customer support; through payment processes; automatically through the Platform and device technologies; from partners and technicians where required to provide services; from third-party providers supporting the Platform; and where otherwise permitted or required by applicable law.",
        ],
      },
      {
        id: "how-we-use",
        title: "5. Purposes for which we use personal data",
        paragraphs: [
          "We use personal data for legitimate business and service purposes, including:",
        ],
        bullets: [
          "Service delivery: schedule and fulfil visits; match customers with partners in their area; assign technicians; provide navigation and location-enabled services; manage AMC plans; track execution; generate records and reports; provide customer support.",
          "Communications: booking confirmations; appointment reminders; OTPs and service verification / happy codes; technician arrival and visit updates; cancellation and refund notifications; important account and service communications.",
          "Payments and financial administration: process payments; record transactions; calculate platform fees; manage refunds and cancellation charges; maintain partner settlement records; detect and prevent payment-related fraud.",
          "Safety, security, and fraud prevention: protect users and the Platform; verify accounts and service activity; investigate suspected fraud or misuse; monitor security incidents; enforce Platform rules; investigate complaints and abuse; maintain service evidence.",
          "Platform improvement: diagnose technical problems; improve performance, booking, and service workflows; analyse aggregate usage patterns; develop features.",
          "Legal and regulatory compliance: comply with laws; respond to lawful government requests; maintain tax and accounting records; resolve disputes; establish, exercise, or defend legal claims; prevent fraud and unlawful activity.",
        ],
      },
      {
        id: "legal-basis",
        title: "6. Legal basis and consent",
        paragraphs: [
          "Depending on the nature of the processing and applicable law, we may process personal data with your consent where required; where processing is necessary to provide a service you requested; to perform contractual or service-related obligations; to comply with legal requirements; for legitimate and lawful operational purposes permitted under applicable law; to protect Platform security; and for other lawful purposes permitted under applicable law.",
          "Where consent is the basis, you may withdraw it where permitted by law. Withdrawal may affect optional or location-dependent features. Withdrawal does not affect processing that was lawfully carried out before withdrawal or that may continue under another lawful basis.",
          "A plain-language summary of mobile app permissions is at /legal/app-permissions. Cookie choices are described in /legal/cookie-policy. Where production data is hosted is described in /legal/data-storage. Detailed subprocessors appear in /legal/data-processing.",
        ],
      },
      {
        id: "location",
        title: "7. Location data",
        paragraphs: [
          "Location data is particularly important to OorjaMan service operations. We may use it to locate the customer's service site; help technicians reach the assigned location; support active-job navigation; enable live technician tracking where applicable; confirm service attendance; and improve safety and coordination.",
          "Location access is controlled through your device permissions. If you disable it, certain location-dependent functions may become unavailable. We do not intend to use customer or technician location information for unrelated purposes.",
        ],
      },
      {
        id: "photographs",
        title: "8. Photographs and service evidence",
        paragraphs: [
          "Customers and technicians may upload photographs of solar panels, rooftops, equipment, installation areas, and service conditions. These may be used to assess requirements; prepare quotations or scope; document pre- and post-service conditions; verify completion; prepare digital inspection reports; resolve disputes; investigate damage or complaints; and improve quality and safety.",
          "Service photographs are not automatically treated as marketing content. If we wish to use identifiable photographs for promotional purposes where separate permission is required, we will seek appropriate permission first.",
        ],
      },
      {
        id: "sharing",
        title: "9. Sharing of personal data",
        paragraphs: [
          "We do not sell personal data. We may share limited information with parties who reasonably need it to provide or support OorjaMan services.",
          "Assigned partners and technicians: where a booking is assigned, we may provide customer name; contact details; service address; site notes; rooftop/system information; relevant photographs; appointment information; and information necessary for navigation and execution. They should access only what is reasonably required for the assigned service.",
          "Infrastructure and technology providers: cloud hosting; databases; authentication; file and image storage; serverless functions; mapping and geocoding; push notifications; payment processing; application monitoring. Current infrastructure may include Supabase (database, authentication, storage, serverless); mapping/geocoding providers; Apple Push Notification Service (APNs); Google Firebase Cloud Messaging (FCM), including through Expo where applicable; and payment processors. Providers are expected to process data only for legitimate purposes subject to contractual, technical, and organisational safeguards.",
          "Legal and regulatory authorities: we may disclose personal data where reasonably necessary to comply with law; respond to lawful government or regulatory requests; protect the rights, property, or safety of OorjaMan, customers, partners, or others; investigate suspected fraud, abuse, or unlawful activity; or establish or defend legal claims.",
        ],
      },
      {
        id: "partner-access",
        title: "10. Partner and technician access",
        paragraphs: [
          "Partners and technicians may receive customer and site information solely to perform assigned services.",
        ],
        bullets: [
          "Partners are responsible for maintaining verified business documents and technician credentials; ensuring appropriate technician conduct; following safety requirements; protecting customer information; accepting or declining bookings within applicable SLA periods; following service checklists; capturing required evidence; and honouring published pricing and AMC visit entitlements.",
          "Partners must not use customer information obtained through OorjaMan to independently market unrelated services, sell customer information, or use such information for unlawful or unauthorised purposes.",
        ],
      },
      {
        id: "security",
        title: "11. Data security",
        paragraphs: [
          "We take reasonable technical and organisational measures designed to protect personal data against unauthorised access, disclosure, accidental loss, destruction, alteration, misuse, and unauthorised processing.",
        ],
        bullets: [
          "Depending on the system and data involved, safeguards may include authentication and access controls; role-based access; secure storage; encryption where appropriate; access logging; monitoring and diagnostic controls; secure software and infrastructure practices; backup and recovery; vendor and processor controls; and incident response procedures.",
          "No digital system can be guaranteed completely secure. Users should maintain strong passwords, protect OTPs and credentials, and promptly report suspected unauthorised access.",
        ],
      },
      {
        id: "incidents",
        title: "12. Data security incidents and breaches",
        paragraphs: [
          "If we become aware of a security incident involving personal data, we will take reasonable steps to investigate; contain and mitigate impact; secure affected systems; assess nature and extent; take appropriate corrective measures; and make notifications or disclosures where required under applicable law. Where legally required, affected users and/or relevant authorities will be notified in accordance with applicable requirements.",
        ],
      },
      {
        id: "retention",
        title: "13. Data retention",
        paragraphs: [
          "We retain personal data only as long as reasonably necessary for the purposes in this Policy or as required or permitted by applicable law. Different categories may be retained for different periods.",
        ],
        bullets: [
          "Account information: while the account is active and for a reasonable period thereafter where necessary for legal, security, or dispute purposes.",
          "Booking and service records: for operational, accounting, tax, dispute-resolution, safety, and legal purposes.",
          "Payment and transaction records: as required for accounting, tax, fraud prevention, payment reconciliation, and legal obligations.",
          "Location records: only as reasonably necessary for service execution, safety, dispute resolution, fraud prevention, and legal obligations.",
          "Photographs and service evidence: for verification, quality control, dispute resolution, safety, and applicable legal or operational requirements.",
          "Support communications: where necessary to resolve disputes, investigate complaints, maintain service records, and protect users and the Platform.",
        ],
      },
      {
        id: "storage-location",
        title: "14. Where we store personal data",
        paragraphs: [
          "Production Platform data — including customer accounts, booking and service records, job evidence stored in our databases and storage buckets, and related operational records — is hosted with our cloud infrastructure provider (Supabase) in India, in the Mumbai region (AWS ap-south-1).",
          "A plain-language Data Storage Policy with provider categories and transfer notes is published at /legal/data-storage. Related processing detail: /legal/data-processing.",
          "Some third-party providers (for example maps, push notification networks, payment rails, or analytics where enabled) may process limited information in other jurisdictions as needed to deliver those services. See Section 26 (International data processing).",
        ],
      },
      {
        id: "account-deletion",
        title: "15. Account deletion",
        paragraphs: [
          "You may request deletion of your OorjaMan customer account. Deletion generally removes sign-in access and personal profile information associated with the account. We may retain limited information where necessary for tax and accounting; fraud prevention; security; dispute resolution; legal claims; regulatory compliance; or other lawful retention requirements.",
          "In the customer app: Profile → Account → Delete Account, then type DELETE to confirm. Active or upcoming bookings may need to be cancelled or completed first. If you have an active AMC plan, the consequences of account deletion, including cancellation of the plan, will be communicated before deletion is completed. After confirmation, sign-in credentials are removed and you may be signed out.",
          `If you cannot use the app, email ${SUPPORT_EMAIL} with subject “Account Deletion Request” and the mobile number or email associated with the account. We may verify ownership first. We aim to respond within 7 business days and generally complete eligible deletion within 30 days, subject to verification, technical requirements, and lawful retention. Full steps: /legal/account-deletion.`,
        ],
      },
      {
        id: "rights",
        title: "16. Your privacy rights and choices",
        paragraphs: [
          "Subject to applicable law, you may have rights to access information about your personal data; request correction of inaccurate or incomplete information; request deletion where legally applicable; withdraw consent where consent is the applicable legal basis; manage notification permissions; manage location permissions through your device; raise privacy-related complaints; and exercise other rights available under applicable law.",
          `You may update certain profile information in the application. For privacy-related requests, contact ${PRIVACY_EMAIL}. We may request reasonable information to verify your identity before processing a request.`,
          "Nothing in this Policy limits rights or protections that cannot lawfully be excluded under the DPDP Act, consumer law, or other mandatory Indian law.",
        ],
      },
      {
        id: "privacy-grievance",
        title: "17. Privacy grievance redressal",
        paragraphs: [
          `We are committed to addressing privacy and data protection concerns promptly. If you believe your personal data has been processed improperly, or if you have a privacy-related complaint, contact ${PRIVACY_EMAIL}. Include sufficient information for us to understand and investigate. We may request additional information to verify identity.`,
          "We will handle grievances in accordance with applicable law and our internal procedures. Formal platform grievances (including non-privacy complaints) are described at /legal/grievance-redressal.",
        ],
      },
      {
        id: "cookies",
        title: "18. Cookies and local storage",
        paragraphs: [
          "The website may use a limited number of strictly necessary cookies and local-storage technologies to load and operate the site; maintain essential functionality; remember your cookie preferences; and maintain basic security and session functionality. These may remain enabled because certain functions cannot operate without them.",
          "We may use optional analytics technologies to understand aggregate traffic and improve content and performance. Analytics are activated only where you provide the applicable consent. If you decline, analytics scripts will not be enabled. You may also block or delete cookies in browser settings; some functions may not operate if necessary cookies or local storage are blocked. Details: /legal/cookie-policy.",
        ],
      },
      {
        id: "marketing",
        title: "19. Marketing and notifications",
        paragraphs: [
          "We may send essential service communications including booking confirmations; appointment reminders; OTPs; service status notifications; payment confirmations; refund notifications; and account and security notifications. These are necessary for operating the Platform and may continue even if you opt out of promotional communications.",
          "Where promotional communications are sent, you may have the option to opt out through the applicable channel or account settings.",
        ],
      },
      {
        id: "children",
        title: "20. Children's data",
        paragraphs: [
          "The Platform and services are intended for individuals who are legally capable of entering into applicable service arrangements. Users must be at least 18 years old to create an account or use OorjaMan services as a customer or service provider, unless otherwise permitted by applicable law.",
          `We do not knowingly permit children to create accounts in violation of applicable law or knowingly collect children's personal data for purposes not permitted under applicable law. If you believe a child has provided personal data improperly, contact ${PRIVACY_EMAIL}.`,
        ],
      },
      {
        id: "acceptable-use",
        title: "21. Acceptable use and responsible conduct",
        paragraphs: [
          "Users are expected to use the Platform responsibly. You must provide accurate contact, property, rooftop, and access information; follow reasonable safety instructions; respect technicians and support personnel; use the Platform only for lawful purposes; and protect your account credentials.",
          "You must not attempt unauthorised access; access another person's account or data; submit false or misleading information; misuse customer, partner, or technician information; interfere with Platform security; use the Platform for unlawful activities; harass, threaten, or abuse technicians, partners, or support staff; use hate speech or threatening language; or circumvent Platform controls or payment mechanisms.",
          `Violations may result in suspension or termination of access, subject to applicable law. Report harassment, threats, abuse, or other misconduct to ${SUPPORT_EMAIL}. We may review relevant communications and metadata to investigate suspected abuse. See also /legal/acceptable-use and /legal/community-guidelines.`,
        ],
      },
      {
        id: "site-safety",
        title: "22. Customer safety and site information",
        paragraphs: [
          "Customers are responsible for providing accurate information regarding property and rooftop access; known hazards; electrical risks; structural concerns; restricted areas; and special site requirements.",
          "Technicians and service partners may refuse, postpone, or terminate a visit where they reasonably believe conditions are unsafe or that performing the work may create a risk of injury, property damage, or electrical/structural hazard. You may be required to reschedule in accordance with cancellation and service policies.",
          "OorjaMan does not provide structural engineering advice and does not replace manufacturer warranties or technical certifications provided by equipment manufacturers. See /legal/service-disclaimers and /safety.",
        ],
      },
      {
        id: "independent-partners",
        title: "23. Independent service partners",
        paragraphs: [
          "OorjaMan operates as a technology marketplace connecting customers with independent service partners. Partners are independent businesses responsible for technician conduct and credentials; required licences and documentation; safety compliance; insurance where required; quality of on-site work; and compliance with applicable laws.",
          "We facilitate booking, scheduling, payment workflows, quality processes, and settlement reporting but do not represent that every partner is an employee or agent of OorjaMan. More: /legal/vendor-partner-agreement.",
        ],
      },
      {
        id: "partner-processing",
        title: "24. Partner data processing",
        paragraphs: [
          "Partners and technicians may process customer information as necessary to perform services through the Platform, including viewing service addresses; contacting customers about appointments; accessing relevant site information and photographs; recording service evidence; updating booking status; and completing service reports.",
          "They must protect such information and must not use it for unrelated or unauthorised purposes. We may require partners and relevant providers to implement appropriate contractual and operational safeguards.",
        ],
      },
      {
        id: "processors",
        title: "25. Data processors and subprocessors",
        paragraphs: [
          "We may appoint third-party processors and infrastructure providers for cloud infrastructure; database management; authentication; storage; maps and geocoding; push notifications; payment processing; application monitoring; and communication infrastructure. We may update providers as the Platform develops. Where appropriate, processors are required to protect personal data through contractual, technical, and organisational measures. Current categories: /legal/data-processing.",
        ],
      },
      {
        id: "international",
        title: "26. International data processing",
        paragraphs: [
          "Our primary production database and file storage for the Platform are located in India (Mumbai), as described in Section 14 and /legal/data-storage.",
          "Some third-party providers may nevertheless process or store limited information in jurisdictions outside India (for example global push-notification networks, mapping services, or other technical providers). Where personal data is transferred, stored, or processed outside India, we will take such measures as may be required under applicable Indian law and other applicable legal requirements.",
        ],
      },
      {
        id: "third-party-links",
        title: "27. Third-party links and services",
        paragraphs: [
          "The Platform may contain links to or integrations with third-party websites and services. OorjaMan is not responsible for the privacy practices, security, or content of independent third parties. Review their policies and terms before providing personal information to them.",
        ],
      },
      {
        id: "cancellation-data",
        title: "28. Cancellation and refund data",
        paragraphs: [
          "We may collect and retain cancellation and refund information to administer bookings and partner settlements. Customers may cancel a booked visit within the one-hour grace period after booking without a late-cancellation fee, as displayed in the application at the time of booking.",
          "Cancellations after the applicable grace period may result in a late-cancellation fee displayed in the application before you confirm. The fee may be recorded against the booking for settlement and accounting.",
          "Eligible refunds for cancelled or failed visits may be processed to the original payment method where applicable. Processing times depend on the bank, payment processor, or UPI provider and typically take about 5-10 business days, though actual times may vary. Full commercial rules: /legal/refund-cancellation.",
        ],
      },
      {
        id: "partner-settlements-data",
        title: "29. Data relating to partner settlements",
        paragraphs: [
          "For partners, we may collect and process information relating to booking acceptance; completed visits; cancellation penalties; service payouts; platform fees; settlement records; payment references; partner documentation; technician credentials; and performance and service records. Visit payouts and cancellation penalties are governed by applicable Platform settlement rules and may be displayed in the partner finance dashboard.",
        ],
      },
      {
        id: "changes",
        title: "30. Changes to this Policy",
        paragraphs: [
          "We may update this Policy from time to time to reflect changes in the Platform, new services, technology, legal or regulatory requirements, or our data processing practices. When material changes are made, we may provide notice through the Platform, website, email, or other appropriate channels where required. The updated Policy will include a revised Last Updated date.",
        ],
      },
      {
        id: "governing-law",
        title: "31. Governing law",
        paragraphs: [
          "This Policy shall be interpreted in accordance with the laws of India, subject to applicable data protection, consumer protection, and other mandatory legal requirements. Nothing in this Policy is intended to limit any rights or protections that cannot lawfully be excluded or restricted under applicable law. Subject to those protections, courts in Guwahati, Assam shall have jurisdiction.",
        ],
      },
      {
        id: "contact",
        title: "32. Contact information",
        paragraphs: [
          `Privacy-related enquiries, data protection requests, complaints, or questions about this Policy: ${PRIVACY_EMAIL}.`,
          `General customer and service support: ${SUPPORT_EMAIL}.`,
          `Account deletion requests: ${SUPPORT_EMAIL} with subject “Account Deletion Request”.`,
          `Grievance Officer correspondence: ${COMPANY_LEGAL_NAME}, ${COMPANY_ADDRESS}. See /legal/grievance-redressal.`,
        ],
      },
      {
        id: "notice",
        title: "33. Important notice",
        paragraphs: [
          "This Policy is intended to explain OorjaMan's data practices in a clear and transparent manner. Nothing in this Policy creates rights or obligations beyond those required by applicable law, OorjaMan's contractual terms, or the specific consent or permission provided by a user.",
          "Where applicable law provides users with rights or protections greater than those described in this Policy, those legal rights and protections will continue to apply.",
        ],
      },
    ],
  },
  {
    slug: "terms-of-service",
    title: "Customer Terms & Conditions",
    description:
      "Customer terms for using the OorjaMan technology marketplace and booking solar care visits.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "agreement",
        title: "Agreement",
        paragraphs: [
          "These Customer Terms & Conditions (“Terms”) govern your use of OorjaMan’s website, customer mobile application, and related services operated by OORJA MAN LLP.",
          "OorjaMan is a technology marketplace / platform. We enable discovery, booking, payments, communications, and quality workflows. On-site solar cleaning and related work are performed by independent verified service partners (“Partners”) and their technicians - not by OorjaMan employees as a cleaning crew.",
        ],
      },
      {
        id: "platform-role",
        title: "Platform role (Indian e-commerce / intermediary framing)",
        paragraphs: [
          "OorjaMan acts as an online intermediary connecting customers with Partners. Partners are responsible for the quality, safety, and lawful performance of on-site services, subject to platform rules, evidence requirements, and applicable law.",
          "Displayed catalogue prices, GST treatment, and geo-tier notes on oorjaman.com / in-app are transparent commercial terms of the platform; the Partner assigned to a visit is the service provider for that visit unless otherwise stated in writing.",
        ],
      },
      {
        id: "eligibility",
        title: "Eligibility",
        paragraphs: [
          "You must be at least 18 years old and able to enter a binding contract under Indian law. You must provide accurate site access and contact information and ensure someone authorised can grant rooftop access at the scheduled time.",
        ],
      },
      {
        id: "bookings",
        title: "Bookings, pricing & AMC",
        bullets: [
          "Prices shown include applicable platform pricing rules; geo-tier surcharges may apply and are disclosed before confirmation where configured.",
          "GST (currently 18% in our published catalogue, unless law changes) is included in consumer-facing amounts where stated on /pricing.",
          "AMC / subscription plans include visit allowances and rules shown at purchase; pause, resume, and cancel controls follow in-app terms.",
          "After Partner acceptance, a booking code may be required for the technician to start the job.",
        ],
        paragraphs: [],
      },
      {
        id: "cancellations",
        title: "Cancellations & refunds",
        paragraphs: [
          "Cancellation windows, late fees, and refunds are governed by our Refund & Cancellation Policy. The fee amount applicable to a late cancel is shown in the app before you confirm.",
        ],
      },
      {
        id: "conduct",
        title: "Acceptable use",
        paragraphs: [
          "You must not misuse the platform, harass Partners, technicians, or support staff, submit false site information, or interfere with safety protocols. Additional rules appear in our Acceptable Use Policy and Community Guidelines.",
        ],
      },
      {
        id: "safety",
        title: "Rooftop safety & disclaimers",
        paragraphs: [
          "Rooftop work involves inherent risks. Customers must provide safe access, disclose known hazards, and follow reasonable safety instructions. Detailed solar / service disclaimers are set out in /legal/service-disclaimers and our Safety page.",
        ],
      },
      {
        id: "liability",
        title: "Liability",
        paragraphs: [
          "To the extent permitted by law, OorjaMan’s liability as platform operator for a given booking is limited to fees paid to OorjaMan for that affected booking in the prior three months. This does not exclude liability that cannot be limited under mandatory consumer law. Manufacturer warranties and structural engineering advice are outside the scope of a cleaning visit.",
        ],
      },
      {
        id: "grievance",
        title: "Complaints",
        paragraphs: [
          "Service issues: support@oorjaman.com or in-app support. Formal grievances: /legal/grievance-redressal.",
        ],
      },
      {
        id: "law",
        title: "Governing law",
        paragraphs: [
          "These Terms are governed by the laws of India. Subject to mandatory consumer protections, courts in Guwahati, Assam shall have jurisdiction.",
        ],
      },
    ],
  },
  {
    slug: "grievance-redressal",
    title: "Grievance Redressal",
    description:
      "How to raise a complaint with OorjaMan and contact the Grievance Officer.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "purpose",
        title: "Purpose",
        paragraphs: [
          "OORJA MAN LLP provides this grievance redressal mechanism for customers, Partners, and other users of the OorjaMan platform, consistent with applicable Indian intermediary / consumer and data-protection expectations.",
        ],
      },
      {
        id: "officer",
        title: "Grievance Officer",
        paragraphs: [
          `Grievance Officer: ${grievanceOfficerLabel()}.`,
          `Email: ${GRIEVANCE_EMAIL}`,
          `Correspondence: ${COMPANY_LEGAL_NAME}, ${COMPANY_ADDRESS}`,
          `For privacy-related complaints, you may also contact ${PRIVACY_EMAIL}. Formal platform grievances (including service and Partner complaints) should be sent to ${GRIEVANCE_EMAIL} as described below.`,
          `Also copy: ${SUPPORT_EMAIL} (operations) · ${LEGAL_EMAIL} (legal notices)`,
        ],
      },
      {
        id: "how",
        title: "How to complain",
        bullets: [
          "In-app: use Support chat for booking or visit issues.",
          `Email ${GRIEVANCE_EMAIL} with your registered mobile number, booking / order reference (if any), and a clear description of the issue.`,
          `For account deletion or privacy requests, you may also use the Account Deletion page or ${PRIVACY_EMAIL}.`,
        ],
        paragraphs: [],
      },
      {
        id: "sla",
        title: "Acknowledgement & timelines",
        paragraphs: [
          "We aim to acknowledge grievances within 48 hours on business days and to provide a reasoned response or resolution path within 15 days where reasonably practicable. Complex payment, insurance, or Partner disputes may take longer; we will keep you informed.",
        ],
      },
      {
        id: "escalation",
        title: "Escalation",
        paragraphs: [
          "If you are not satisfied with the response, reply to the same thread marking it “Escalation”. You also retain rights under applicable consumer forums and, for personal data matters, remedies available under the DPDP Act / Rules.",
        ],
      },
    ],
  },
  {
    slug: "app-permissions",
    title: "App Permissions & Consent",
    description:
      "Why the OorjaMan customer and technician apps request Location, Camera, Photos, and Notifications.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "overview",
        title: "Overview",
        paragraphs: [
          "OorjaMan apps request device permissions only when needed for a feature. You can deny or later revoke permissions in system settings; some features will then be unavailable.",
          "We do not request access to your Contacts.",
        ],
      },
      {
        id: "customer",
        title: "Customer app",
        bullets: [
          "Location: tag rooftop site photos with GPS, match nearby cleaning partners, and improve visit ETAs when you allow it.",
          "Camera: capture geo-tagged photos of your rooftop / panels for scoping and records.",
          "Photos / media library: attach existing images of your solar site.",
          "Notifications: booking updates, technician en-route alerts, support messages, and similar service notices when you allow push notifications.",
        ],
        paragraphs: [],
      },
      {
        id: "technician",
        title: "Technician (Partner) app",
        bullets: [
          "Location (while in use): job routing and live location sharing with the customer after you mark en route / during an active visit.",
          "Camera & photos: before/after evidence and start-of-visit selfies required by safety / job workflows.",
          "Notifications: new assignments, support messages, and operational alerts.",
          "Documents: partners may upload onboarding documents (e.g. ID) through controlled flows - not a blanket Contacts access.",
        ],
        paragraphs: [],
      },
      {
        id: "website",
        title: "Website",
        paragraphs: [
          "This website may ask for optional analytics cookies via the consent banner. Strictly necessary storage for consent preference is always on. See Cookie Policy.",
        ],
      },
      {
        id: "withdraw",
        title: "Withdrawing consent",
        paragraphs: [
          "Revoke permissions in iOS/Android settings, decline analytics cookies on the site, or contact privacy@oorjaman.com. Account deletion instructions: /legal/account-deletion.",
        ],
      },
    ],
  },
  {
    slug: "service-disclaimers",
    title: "Service Terms, Solar Safety & Disclaimers",
    description:
      "Safety expectations and limitations for rooftop solar cleaning visits arranged via OorjaMan.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "nature",
        title: "Nature of service",
        paragraphs: [
          "Visits arranged through OorjaMan are typically panel cleaning and related care performed by Partner technicians. They are not a substitute for licensed electrical work, structural assessment, or manufacturer-authorised repairs unless expressly agreed in writing.",
        ],
      },
      {
        id: "customer-duties",
        title: "Customer responsibilities",
        bullets: [
          "Provide safe rooftop access and disclose known hazards (fragile sheets, open edges, live equipment, pets, electrical risks, structural concerns, restricted areas, etc.).",
          "Ensure water availability where the visit type requires it, or disclose constraints in advance.",
          "Be reachable for OTP / booking codes and site instructions.",
        ],
        paragraphs: [],
      },
      {
        id: "partner-duties",
        title: "Partner & technician responsibilities",
        bullets: [
          "Follow platform safety checklists before starting work.",
          "Use appropriate PPE and decline unsafe conditions.",
          "Capture required evidence (e.g. before/after photos) per job workflow.",
        ],
        paragraphs: [],
      },
      {
        id: "risks",
        title: "Inherent risks",
        paragraphs: [
          "Working at height and around solar equipment involves residual risk even with care. Weather, site conditions, and third-party equipment condition can affect outcomes. Technicians and Partners may refuse, postpone, or terminate a visit where they reasonably believe conditions are unsafe or that performing the work may create a risk of injury, property damage, or electrical/structural hazard. See also /safety for our quality programme summary.",
        ],
      },
      {
        id: "no-warranty-panels",
        title: "Performance & warranties",
        paragraphs: [
          "Cleaning may improve soiling-related losses but OorjaMan does not guarantee specific generation increases. Panel, inverter, and mounting warranties remain with the respective manufacturers / EPCs. OorjaMan does not provide structural engineering advice and does not replace manufacturer warranties or technical certifications.",
        ],
      },
    ],
  },
  {
    slug: "account-deletion",
    title: "Account Deletion",
    description:
      "How to delete your OorjaMan account (App Store / Play compliance) and what happens to your data.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "overview",
        title: "Overview",
        paragraphs: [
          "You can delete your OorjaMan customer account at any time. Deletion removes sign-in access and personal profile data. Booking and payment records needed for tax, fraud prevention, or dispute resolution may be retained as required by law.",
        ],
      },
      {
        id: "in-app",
        title: "Delete in the app",
        bullets: [
          "Open the OorjaMan customer app and sign in.",
          "Go to Profile → Account → Delete account.",
          "Type DELETE to confirm. Active or upcoming bookings may need to be cancelled or completed first. If you have an active AMC plan, the consequences of account deletion, including cancellation of the plan, will be communicated before deletion is completed.",
        ],
        paragraphs: [
          "After confirmation, your sign-in credentials are removed and you are signed out.",
        ],
      },
      {
        id: "email",
        title: "Request by email (backup)",
        paragraphs: [
          "If you cannot use the app, email support@oorjaman.com from your registered phone number or email with the subject “Account Deletion Request”. Include the mobile number used to sign in. We will verify ownership and respond within 7 business days.",
        ],
      },
      {
        id: "timeline",
        title: "Processing timeline",
        paragraphs: [
          "Most eligible requests complete within 30 days, subject to verification, technical requirements, and lawful retention. We may retain minimal records required by law (tax, fraud prevention, dispute resolution) after deletion.",
        ],
      },
    ],
  },
  {
    slug: "refund-cancellation",
    title: "Refund & Cancellation Policy",
    description: "Cancellations, grace periods, late fees, AMC, and refunds.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "grace",
        title: "Customer visit - grace window",
        paragraphs: [
          "Customers may cancel a booked visit within the one-hour grace window after booking without a late-cancellation fee, as shown in the app at the time of booking.",
        ],
      },
      {
        id: "late-fee",
        title: "Late cancellation",
        paragraphs: [
          "Cancellations after the grace window may incur a late-cancellation fee. The current fee amount is displayed in the app before you confirm cancellation and is recorded against the booking for Partner settlement where applicable.",
        ],
      },
      {
        id: "partner-cancel",
        title: "Partner inability / reassignment",
        paragraphs: [
          "If a Partner cannot fulfil an accepted visit, the platform may reassign the booking to another Partner or return it to operations. You will be notified through the app or SMS/push where enabled. Platform and Partner cancellation rules (including any penalties) follow settlement policies shown to Partners.",
        ],
      },
      {
        id: "amc",
        title: "AMC / subscriptions",
        paragraphs: [
          "You may pause, resume, or cancel an AMC plan in the app subject to the plan terms shown at purchase. Visit entitlements already consumed are not refundable; unused prepaid value is handled as stated at purchase or by written support confirmation. Auto-generated future visits are adjusted when you pause or cancel.",
        ],
      },
      {
        id: "no-show",
        title: "Access failures & no-shows",
        paragraphs: [
          "If technicians cannot complete a visit because site access was not provided after reasonable attempts, the visit may be marked incomplete and rebooking or fees may apply as disclosed in-app or by support.",
        ],
      },
      {
        id: "refunds",
        title: "Refunds",
        paragraphs: [
          "Eligible refunds for cancelled or failed paid visits may be processed to the original payment method where applicable. Processing times depend on the bank, payment processor, or UPI provider and typically take about 5-10 business days after we initiate the refund, although actual times may vary.",
        ],
      },
      {
        id: "pricing-link",
        title: "Transparent pricing",
        paragraphs: [
          "Public catalogue pricing (including GST notes) is published at /pricing. Final payable amounts for a specific slot or geo-tier are confirmed in the customer app before payment.",
        ],
      },
    ],
  },
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    description: "Cookies and similar technologies on oorjaman.com.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "what",
        title: "What we use",
        paragraphs: [
          "This website uses a small number of strictly necessary cookies and local storage to load and operate the site, maintain essential functionality, remember your cookie choice, and maintain basic security and session functionality. These may remain enabled because certain website functions cannot operate without them.",
          "We may also use optional analytics cookies to understand aggregate traffic and improve content and performance. Analytics technologies are activated only where you provide the applicable consent and are never enabled by default. If you decline, analytics scripts will not be loaded.",
        ],
      },
      {
        id: "consent",
        title: "Your consent",
        paragraphs: [
          "When you first visit, a banner lets you Accept or Decline optional analytics cookies. If you decline, no analytics scripts are loaded. Your choice is stored in your browser and can be changed any time by clearing this site's data in your browser settings.",
        ],
      },
      {
        id: "control",
        title: "Your choices",
        paragraphs: [
          "You can also block or delete cookies in your browser settings. Certain website functions may not operate correctly if necessary cookies or local storage are blocked.",
        ],
      },
    ],
  },
  {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    description: "Rules for using OorjaMan platforms responsibly.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "rules",
        title: "Rules",
        bullets: [
          "Provide accurate contact, property, rooftop, and access information.",
          "Follow reasonable safety instructions and respect technicians and support staff.",
          "Use the Platform only for lawful purposes and protect your account credentials.",
          "Do not attempt unauthorised access to systems or another person's account or data.",
          "Do not submit false or misleading information or misuse customer, partner, or technician information.",
          "Do not interfere with Platform security, circumvent payment controls, or use the Platform for unlawful activities.",
          "Do not harass, threaten, or abuse technicians, partners, or support staff, and do not use hate speech or threatening language.",
        ],
        paragraphs: [
          `Violations may result in suspension or termination of Platform access, subject to applicable law. Report concerns to ${SUPPORT_EMAIL}. We may review relevant communications and metadata to investigate suspected abuse.`,
        ],
      },
    ],
  },
  {
    slug: "community-guidelines",
    title: "Community Guidelines",
    description: "Standards for in-app chat and support interactions.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "respect",
        title: "Be respectful",
        paragraphs: [
          "Support chat and notifications exist to resolve service issues. Harassment, hate speech, or threats are prohibited.",
        ],
      },
      {
        id: "reports",
        title: "Reporting",
        paragraphs: [
          "Report concerns to support@oorjaman.com or via Grievance Redressal. We may review relevant communications and metadata to investigate suspected abuse, subject to applicable law.",
        ],
      },
    ],
  },
  {
    slug: "vendor-partner-agreement",
    title: "Marketplace & Vendor Partner Information",
    description:
      "How the OorjaMan marketplace works for Partners and what customers should know.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "marketplace",
        title: "Marketplace model",
        paragraphs: [
          "OorjaMan is a technology marketplace. Customers book through our apps/website; verified Partners accept jobs, assign technicians, and perform on-site work. OorjaMan provides demand, pricing tools, booking codes, evidence workflows, and settlement reporting.",
        ],
      },
      {
        id: "relationship",
        title: "Partner relationship",
        paragraphs: [
          "Partners are independent businesses responsible for technician conduct, safety compliance, insurance where required, and visit quality. Becoming a partner requires registration, document review, and approval before visibility to customers.",
        ],
      },
      {
        id: "obligations",
        title: "Partner obligations",
        bullets: [
          "Maintain verified documents and technician credentials.",
          "Accept or decline bookings within SLA windows (including the one-hour response expectation where applicable).",
          "Follow safety checklists and evidence capture requirements.",
          "Honour published pricing and AMC visit entitlements.",
        ],
        paragraphs: [],
      },
      {
        id: "customer-visibility",
        title: "What customers see",
        paragraphs: [
          "Only approved Partners are listed for booking. After acceptance you may see Partner / technician assignment details needed for the visit. Public programme information: /partners.",
        ],
      },
      {
        id: "partner-data",
        title: "Partner handling of customer data",
        paragraphs: [
          "Partners and technicians may process customer information as necessary to perform assigned services, including viewing service addresses; contacting customers about appointments; accessing relevant site information and photographs; recording service evidence; updating booking status; and completing service reports. They must protect such information and must not use it for unrelated marketing, sale of customer information, or other unauthorised purposes.",
        ],
      },
      {
        id: "payments",
        title: "Settlements",
        paragraphs: [
          "Visit payouts and cancellation penalties follow platform settlement rules in the partner finance dashboard. Platform fees are deducted as configured by OorjaMan operations.",
        ],
      },
    ],
  },
  {
    slug: "data-storage",
    title: "Data Storage Policy",
    description:
      "Where OorjaMan stores production Platform data, which infrastructure we use, and how transfers outside India are handled.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "summary",
        title: "Summary",
        paragraphs: [
          "This Data Storage Policy explains where OorjaMan stores personal data and related Platform records for the live (production) service. It complements the Privacy & Data Protection Policy (/legal/privacy-policy) and the Data Processing Notice (/legal/data-processing).",
          `${COMPANY_LEGAL_NAME} is responsible for determining the purposes and means of processing customer Platform data, subject to applicable Indian law including the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025, as applicable.`,
        ],
      },
      {
        id: "primary-location",
        title: "Primary storage location (production)",
        paragraphs: [
          "Production Platform data is hosted with our cloud infrastructure provider Supabase in India, in the Mumbai region (Amazon Web Services region ap-south-1).",
          "This includes, without limitation: account and profile records; booking and AMC / subscription records; service and settlement records; in-app notification and support records; and files stored in our production storage buckets (for example job and site photographs), subject to retention and deletion rules in the Privacy Policy.",
        ],
      },
      {
        id: "what-is-stored",
        title: "What is stored where",
        bullets: [
          "Primary application database and authentication for production: Supabase project hosted in Mumbai, India.",
          "Object / file storage for production media and documents: Supabase Storage in the same production project (India / Mumbai).",
          "Serverless functions that support the Platform: deployed against the same production project.",
          "Non-production / staging environments (if used): may be hosted in other regions for testing only and are not the system of record for live customer service.",
        ],
        paragraphs: [],
      },
      {
        id: "security",
        title: "Security of stored data",
        paragraphs: [
          "We use encrypted transport (HTTPS/TLS) for Platform traffic; access-controlled storage buckets (including private buckets for sensitive job evidence); and role-based database access controls (including Row Level Security) designed so users and partners only reach data they are authorised to see.",
          "Further security and retention detail: Privacy Policy Sections 11–15 and /legal/account-deletion.",
        ],
      },
      {
        id: "subprocessors",
        title: "Other providers that may receive data",
        paragraphs: [
          "To operate the Platform we use subprocessors such as payment processors, mapping / geocoding providers, push-notification networks (for example Apple APNs and Google FCM, including through Expo where applicable), and other technical providers. Those providers may process limited data as needed to deliver their service, and some may operate infrastructure outside India.",
          "Current categories and more detail: /legal/data-processing. We do not sell personal data.",
        ],
      },
      {
        id: "transfers",
        title: "Transfers outside India",
        paragraphs: [
          "While our primary production database and file storage are in India (Mumbai), limited personal data may be processed outside India by certain third-party providers (for example global push or mapping networks). Where such processing occurs, we will take measures required under applicable Indian law.",
        ],
      },
      {
        id: "changes",
        title: "Changes",
        paragraphs: [
          "If we change the primary production hosting region or material storage arrangements, we will update this Policy (and related notices) and revise the Last Updated date. Material changes may also be communicated through the Platform or website where appropriate.",
        ],
      },
      {
        id: "contact",
        title: "Contact",
        paragraphs: [
          `Questions about data storage or privacy: ${PRIVACY_EMAIL}. Support: ${SUPPORT_EMAIL}. Grievances: /legal/grievance-redressal.`,
        ],
      },
    ],
  },
  {
    slug: "data-processing",
    title: "Data Processing Notice",
    description:
      "DPDP-oriented summary of processing purposes, storage, subprocessors, and international transfers.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        id: "roles",
        title: "Roles",
        paragraphs: [
          `${COMPANY_LEGAL_NAME} acts as Data Fiduciary for customer and user accounts on the Platform. Assigned Partners process visit data as needed to deliver the service (comparable to a processor / service provider for that operational purpose).`,
        ],
      },
      {
        id: "purposes",
        title: "Processing purposes",
        bullets: [
          "Identity verification via mobile OTP.",
          "Booking, routing, fulfilment, and job evidence.",
          "Payments, invoices, refunds, and Partner settlements.",
          "Support chat and grievance handling.",
          "Security, fraud prevention, and service analytics that do not require selling personal data.",
        ],
        paragraphs: [],
      },
      {
        id: "storage",
        title: "Storage & security measures",
        paragraphs: [
          "Production Platform data is hosted with our cloud infrastructure provider (Supabase) in India — Mumbai region (AWS ap-south-1) — using encrypted transport, access-controlled storage buckets (e.g. private job photos), and role-based database policies (RLS). See /legal/data-storage for the dedicated Data Storage Policy. Retention follows the Privacy & Data Protection Policy and Account Deletion rules.",
        ],
      },
      {
        id: "subprocessors",
        title: "Infrastructure & subprocessors",
        bullets: [
          "Cloud database, authentication, storage, and serverless functions (Supabase) — production hosted in Mumbai, India.",
          "Maps and geocoding providers when you use location features.",
          "Push notification delivery (Apple APNs, Google FCM, including through Expo where applicable).",
          "Payment processors integrated for checkout (when enabled).",
          "Application monitoring, communication infrastructure, and other technical providers as the Platform develops.",
        ],
        paragraphs: [
          "We require subprocessors to protect data under contract, including contractual, technical, and organisational measures where appropriate. Categories may change as we add providers; material changes will be reflected here.",
        ],
      },
      {
        id: "international",
        title: "International processing",
        paragraphs: [
          "Primary production database and file storage are in India (Mumbai). Some third-party providers may still process or store limited information in jurisdictions outside India. Where personal data is transferred, stored, or processed outside India, we will take such measures as may be required under applicable Indian law and other applicable legal requirements. Full storage notice: /legal/data-storage.",
        ],
      },
      {
        id: "rights",
        title: "Requests",
        paragraphs: [
          "Data principal requests: privacy@oorjaman.com. Grievances: /legal/grievance-redressal.",
        ],
      },
    ],
  },
];

export function getLegalDocument(slug: string): LegalDocument | undefined {
  return legalDocuments.find((d) => d.slug === slug);
}

export const legalNav = legalDocuments.map((d) => ({
  slug: d.slug,
  title: d.title,
  href: `/legal/${d.slug}`,
}));

export const footerLegalNav = footerLegalSlugs
  .map((slug) => legalNav.find((item) => item.slug === slug))
  .filter((item): item is (typeof legalNav)[number] => Boolean(item));

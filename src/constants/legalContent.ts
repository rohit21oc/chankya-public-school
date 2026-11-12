import type { SchoolSettings } from '../types';

export type LegalDocId = 'privacy' | 'cookies';

export interface LegalSection {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface LegalDocument {
  id: LegalDocId;
  title: string;
  path: string;
  summary: string;
  sections: LegalSection[];
}

export const LEGAL_LAST_UPDATED = '24 October 2026';

/** Contact details come from School Settings, so the policies never show a made-up address or number. */
export function legalContact(settings: SchoolSettings) {
  return {
    name: settings.schoolName || 'the School',
    address: settings.schoolAddress || '',
    email: settings.email || '',
    phone: settings.helplineNumber || '',
  };
}

export function buildPrivacyPolicy(settings: SchoolSettings): LegalDocument {
  const c = legalContact(settings);
  const contactLine = [c.email && `Email: ${c.email}`, c.phone && `Phone: ${c.phone}`, c.address && `Address: ${c.address}`].filter(Boolean) as string[];
  return {
    id: 'privacy',
    title: 'Privacy Policy',
    path: '/privacy-policy',
    summary: `How ${c.name} collects, uses, shares and protects personal information on its website, school portal and mobile app.`,
    sections: [
      {
        id: 'about',
        title: 'About this policy',
        paragraphs: [
          `${c.name} ("the School", "we", "us") operates a public website, a school management portal and a mobile app for parents, students and staff. This policy explains what personal information we handle through them, why, and what choices you have.`,
          'It applies to visitors of the website, to parents and guardians, to students, and to teaching and non-teaching staff who use the portal or the app. Information held on paper at the School is covered by the School\'s own record-keeping practices.',
        ],
      },
      {
        id: 'collect',
        title: 'Information we collect',
        paragraphs: ['What we hold depends on how you interact with the School.'],
        table: {
          head: ['Who', 'Information', 'Source'],
          rows: [
            ['Students', 'Name, date of birth, class and section, admission and roll details, photograph, guardian details, address, attendance, exam marks and results, fee records, ID-card information', 'Provided by parents or guardians at admission, and created by the School during the academic year'],
            ['Parents and guardians', 'Name, relationship, phone number, email address, address, payment records for fees', 'Provided by you at admission or enquiry'],
            ['Staff', 'Name, contact details, designation, qualifications, attendance and leave records, assigned classes, salary and payroll records', 'Provided by the staff member and created by the School'],
            ['Website visitors', 'Name, phone number, email and message you submit through an enquiry or contact form', 'Provided by you'],
            ['Portal and app users', 'Login identifier, account role, sign-in activity, device push-notification token (app only), audit records of actions taken in the portal', 'Created when you use the service'],
          ],
        },
        bullets: [
          'We do not collect precise location, contacts, microphone recordings, or advertising identifiers.',
          'The app asks for camera access only when staff scan ID cards to record attendance. Images are used to read the card and are not kept by the app.',
          'Passwords are stored only in hashed form.',
        ],
      },
      {
        id: 'use',
        title: 'How we use information',
        bullets: [
          'Admitting and teaching students, and keeping their academic, attendance and fee records.',
          'Communicating with parents and staff about attendance, results, fees, notices and school events, by notification, SMS or email.',
          'Processing fee payments and issuing receipts.',
          'Managing staff attendance, leave and payroll.',
          'Keeping accounts secure, preventing misuse, and maintaining an audit trail of changes to school records.',
          'Meeting obligations to the CBSE, education authorities and other applicable law.',
        ],
        paragraphs: ['We do not sell personal information, and we do not use it for advertising or for profiling children.'],
      },
      {
        id: 'children',
        title: 'Children\'s information',
        paragraphs: [
          'Most of the personal information we hold relates to children. We collect it from a parent or guardian, or from the child under the School\'s supervision, and only to the extent needed for schooling and school safety.',
          'A parent or guardian gives consent for their child\'s information when they enrol the child. We do not run behavioural tracking or targeted advertising directed at children.',
        ],
      },
      {
        id: 'sharing',
        title: 'Who we share information with',
        paragraphs: ['Access inside the School is limited by role. For example, a teacher sees the classes assigned to them, and a parent sees only their own child. We share information outside the School only in these cases:'],
        table: {
          head: ['Recipient', 'Purpose'],
          rows: [
            ['PhonePe', 'Online fee payment processing'],
            ['Brevo', 'Sending emails such as password resets and notices'],
            ['Fast2SMS', 'Sending SMS messages'],
            ['MongoDB Atlas', 'Hosted database where school records are stored'],
            ['Cloudflare R2', 'Storage for uploaded files such as photographs and documents'],
            ['Expo and Google Firebase Cloud Messaging', 'Delivering push notifications to the mobile app'],
            ['Google Maps', 'Showing the School\'s location on the website, only if you allow embedded content'],
          ],
        },
        bullets: [
          'These providers act on the School\'s instructions and receive only what is needed for the service.',
          'We disclose information to authorities, courts or the CBSE where the law requires it.',
        ],
      },
      {
        id: 'retention',
        title: 'How long we keep information',
        paragraphs: [
          'Academic, fee and admission records are kept for as long as the School needs them to serve the student, to issue certificates and transcripts, and to meet legal and regulatory requirements. Enquiry messages are kept only as long as needed to respond and follow up.',
          'When information is no longer needed, it is deleted or anonymised.',
        ],
      },
      {
        id: 'security',
        title: 'How we protect information',
        bullets: [
          'Connections to the website, portal and app use HTTPS.',
          'Access is controlled by role, and sign-in attempts are rate limited.',
          'Important changes to school records are written to an audit log.',
          'Passwords are hashed and are never shown to staff or administrators.',
        ],
        paragraphs: ['No system is perfectly secure. If a security incident affects your information, we will take steps to contain it and will notify those affected and the authorities as required by law.'],
      },
      {
        id: 'rights',
        title: 'Your rights and choices',
        paragraphs: ['Under the Digital Personal Data Protection Act, 2023 and other applicable law, you can ask the School to:'],
        bullets: [
          'Tell you what personal information we hold about you or your child.',
          'Correct information that is inaccurate or incomplete.',
          'Delete information that is no longer needed, subject to records we must keep by law.',
          'Withdraw consent that you have given. This may limit the services we can offer.',
          'Nominate someone to exercise these rights on your behalf.',
        ],
      },
      {
        id: 'deletion',
        title: 'Account and data deletion',
        paragraphs: [
          'To request deletion of an account or of personal information, write to the School using the contact details below, from the email address or phone number registered with the School. For a student, the request should come from the parent or guardian.',
          'We will verify the request, delete what we are able to delete, and tell you if any records must be retained, for example fee and academic records required by law. Push-notification registrations for the app are removed when you sign out.',
        ],
      },
      {
        id: 'changes',
        title: 'Changes to this policy',
        paragraphs: [`We may update this policy when our services or legal requirements change. The date at the top shows when it was last revised. Material changes will be announced on the website or in the app. This version was last updated on ${LEGAL_LAST_UPDATED}.`],
      },
      {
        id: 'contact',
        title: 'Contact and grievances',
        paragraphs: [
          `For questions about this policy, to exercise your rights, or to raise a concern about how your information is handled, contact ${c.name}.`,
        ],
        bullets: contactLine.length ? contactLine : undefined,
      },
    ],
  };
}

export function buildCookiePolicy(settings: SchoolSettings): LegalDocument {
  const c = legalContact(settings);
  return {
    id: 'cookies',
    title: 'Cookie Policy',
    path: '/cookie-policy',
    summary: `What ${c.name}'s website stores on your device, why, and how to change your choices.`,
    sections: [
      {
        id: 'what',
        title: 'What this covers',
        paragraphs: [
          'Cookies are small files that a website places on your device. Websites also use similar browser storage (local storage and session storage) for the same purposes. This policy refers to all of these as "cookies".',
          'We keep this to the minimum needed to run the website and the school portal. We do not use advertising, tracking or analytics cookies.',
        ],
      },
      {
        id: 'essential',
        title: 'Essential storage',
        paragraphs: ['These items are needed for the site to work, so they are always on and do not require consent.'],
        table: {
          head: ['Name', 'Purpose', 'Duration'],
          rows: [
            ['cps_auth_token, cps_auth_user', 'Keeps you signed in to the school portal', 'Until you sign out, or until the browser session ends if you did not choose to stay signed in'],
            ['cps_auth_storage_type', 'Remembers whether you chose to stay signed in', 'Same as sign-in'],
            ['cps.cookieConsent', 'Records your choice on this page', 'Until you clear site data or change your choice'],
            ['cps_school_erp, portal_sidebar_collapsed', 'Keeps portal data and layout preferences on your device', 'Until you clear site data'],
            ['cps_student_admission_draft', 'Saves an admission form you have started so it is not lost', 'Until you submit the form or clear site data'],
          ],
        },
      },
      {
        id: 'optional',
        title: 'Optional: embedded third-party content',
        paragraphs: [
          'The Contact section of the website shows our location with an embedded Google Maps view. Loading it connects your browser to Google, which receives your IP address and may set its own cookies under Google\'s own policies.',
          'This loads only if you select "Accept all" or turn on embedded content in your choices. Without it, the map is replaced by a link that opens the location in Google Maps.',
        ],
      },
      {
        id: 'fonts',
        title: 'Fonts',
        paragraphs: ['Some pages use fonts served by Google Fonts. Fetching a font file sends your IP address to Google. No cookies are set for this purpose.'],
      },
      {
        id: 'manage',
        title: 'Managing your choices',
        bullets: [
          'Use "Cookie settings" in the website footer at any time to change your choice.',
          'You can also delete cookies and site data in your browser settings. Doing so signs you out and brings the cookie notice back.',
          'Blocking essential storage in your browser will prevent sign-in from working.',
        ],
      },
      {
        id: 'app',
        title: 'The mobile app',
        paragraphs: ['The mobile app does not use cookies for tracking. It stores your sign-in session securely on the device and a notification token so the School can send you alerts. Details are in the Privacy Policy.'],
      },
      {
        id: 'contact',
        title: 'Questions',
        paragraphs: [
          `For questions about this policy, contact ${c.name}${c.email ? ` at ${c.email}` : ''}.`,
        ],
      },
    ],
  };
}

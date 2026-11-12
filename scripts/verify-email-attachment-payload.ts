/**
 * Offline check of the Brevo request built by emailService (no email is sent).
 * Replaces fetch with a stub that records the request and returns a chosen Brevo response, then checks:
 * attachment encoding and name, recipient, success only on Brevo 201, no invented message id, and that
 * failures are reported as failures.
 *
 * Usage: npx tsx scripts/verify-email-attachment-payload.ts
 */
process.env.BREVO_API_KEY = 'xkeysib-offline-test-key-not-real-0000000000000000';
process.env.BREVO_SENDER_EMAIL = 'office@example.com';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

type Stub = { status: number; body: any };
let next: Stub = { status: 201, body: { messageId: '<abc@smtp-relay.brevo.com>' } };
let lastPayload: any = null;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init?: any) => {
  const u = String(url);
  if (u.endsWith('/v3/account')) return new Response('{}', { status: 200 });
  if (u.endsWith('/v3/smtp/email')) {
    lastPayload = JSON.parse(String(init?.body || '{}'));
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(url, init);
}) as typeof fetch;

async function main() {
  const { emailService } = await import('../server/services/emailService.ts');
  const pdf = Buffer.from('%PDF-1.4\n% test letter\n%%EOF');

  next = { status: 201, body: { messageId: '<abc@smtp-relay.brevo.com>' } };
  const ok = await emailService.sendEmail({
    to: 'Parent.Name@Example.com',
    subject: 'Admission Letter – Test (64010001)',
    html: '<p>Letter attached</p>',
    attachments: [{ name: 'Admission-Letter-64010001.pdf', contentBase64: pdf.toString('base64') }],
  });
  check('Accepted message is reported as success', ok.success === true);
  check('Brevo message id is passed through', ok.messageId === '<abc@smtp-relay.brevo.com>', String(ok.messageId));
  check('Recipient is the given address (normalised)', lastPayload?.to?.[0]?.email === 'parent.name@example.com');
  check('PDF is attached with its file name', lastPayload?.attachment?.[0]?.name === 'Admission-Letter-64010001.pdf');
  check('Attachment content is the base64 PDF', Buffer.from(lastPayload?.attachment?.[0]?.content || '', 'base64').subarray(0, 5).toString() === '%PDF-');
  check('Request carries no API key in the body', !JSON.stringify(lastPayload).includes('xkeysib'));

  next = { status: 201, body: {} };
  const noId = await emailService.sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>' });
  check('No message id is invented when Brevo omits it', noId.success === true && noId.messageId === undefined, String(noId.messageId));

  next = { status: 400, body: { code: 'invalid_parameter', message: 'sender not verified' } };
  const rejected = await emailService.sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>' });
  check('A rejected message is reported as a failure', rejected.success === false);

  next = { status: 500, body: {} };
  const serverErr = await emailService.sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>' });
  check('A provider error is reported as a failure', serverErr.success === false);

  const badRecipient = await emailService.sendEmail({ to: 'not-an-email', subject: 's', html: '<p>x</p>' });
  check('An invalid recipient is refused before sending', badRecipient.success === false);

  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll email payload checks passed.');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

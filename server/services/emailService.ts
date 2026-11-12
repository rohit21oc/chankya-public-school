import 'dotenv/config';

export interface EmailAttachment {
  /** File name shown to the recipient, e.g. "Admission-Letter-64010012.pdf". */
  name: string;
  /** File content, base64 encoded. */
  contentBase64: string;
}

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  recipientName?: string;
  attachments?: EmailAttachment[];
}

export interface EmailDispatchResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
  rawBrevoMessage?: string;
  statusCode?: number;
  timestamp: string;
}

const SCHOOL_NAME_DEFAULT = 'RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR';
const SCHOOL_ADDRESS_DEFAULT = 'BRC Near Shahpur Road, Sheohar, Bihar - 843329';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_ACCOUNT_URL = 'https://api.brevo.com/v3/account';

class EmailService {
  private apiKey: string = '';
  private senderEmail: string = '';
  private senderName: string = '';
  private configured: boolean = false;

  constructor() {
    this.reloadConfiguration();
  }

  /**
   * Reads Brevo API configuration exclusively from backend environment variables.
   * Never exposed to frontend or public code.
   */
  public reloadConfiguration(): void {
    const rawApiKey = (process.env.BREVO_API_KEY || '')
      .trim()
      .replace(/^["']|["']$/g, '');
    const rawSenderEmail = (
      process.env.BREVO_SENDER_EMAIL ||
      process.env.EMAIL_FROM ||
      'residentialpdspublicschool@gmail.com'
    )
      .trim()
      .replace(/^["']|["']$/g, '');
    const rawSenderName = (
      process.env.BREVO_SENDER_NAME ||
      SCHOOL_NAME_DEFAULT
    )
      .trim()
      .replace(/^["']|["']$/g, '');

    this.apiKey = rawApiKey;
    this.senderEmail = rawSenderEmail;
    this.senderName = rawSenderName;
    this.configured = Boolean(this.apiKey && this.apiKey.length > 10 && this.senderEmail.includes('@'));

    console.log('[EmailService] Provider: Brevo Transactional Email API (REST v3)');
    console.log(`[EmailService] Sender: "${this.senderName}" <${this.senderEmail}>`);
    console.log(`[EmailService] Status: ${this.configured ? 'Configured (API key present)' : 'Unconfigured (Awaiting BREVO_API_KEY in backend environment)'}`);
  }

  /**
   * Sanitizes strings and errors so API keys, tokens, and passwords are never logged.
   */
  private sanitizeError(err: any): string {
    if (!err) return 'Unknown email dispatch error';
    const msg = String(err.message || err || '');
    return msg
      .replace(/xkeysib-[a-zA-Z0-9_-]+/gi, 'xkeysib-***')
      .replace(/[a-zA-Z0-9_-]{28,}/g, '***')
      .replace(/(?:api-key|key|token|password|pass|secret)=([^\s&"']+)/gi, '$1=***');
  }

  /**
   * Sends an email via official Brevo Transactional Email API (REST v3: POST https://api.brevo.com/v3/smtp/email).
   */
  public async sendEmail(options: EmailSendOptions): Promise<EmailDispatchResult> {
    const timestamp = new Date().toISOString();

    // Check for fresh environment variable updates on every dispatch to eliminate caching of old deployment values
    this.reloadConfiguration();

    const keyPrefix = this.apiKey ? this.apiKey.substring(0, 8) : 'NONE';
    const keyLength = this.apiKey ? this.apiKey.length : 0;
    const isXkey = this.apiKey ? this.apiKey.startsWith('xkeysib-') : false;

    // Safe backend diagnostic logging without exposing secret key value
    console.log('[EmailService] Dispatch Verification:', {
      keyExists: Boolean(this.apiKey),
      keyPrefix,
      keyLength,
      senderEmail: this.senderEmail,
      isRestApiKey: isXkey,
      endpoint: BREVO_API_URL,
      header: 'api-key',
    });

    if (!this.configured || !this.apiKey) {
      console.warn('[EmailService] Brevo API error: BREVO_API_KEY or BREVO_SENDER_EMAIL not configured in backend environment variables.');
      return {
        success: false,
        provider: 'Brevo Transactional Email API',
        error: 'Unable to send the email. Please try again later.',
        timestamp,
      };
    }

    if (!isXkey) {
      console.warn(`[EmailService] Configured BREVO_API_KEY prefix is "${keyPrefix}". In Brevo, REST API v3 keys must begin with "xkeysib-".`);
    }

    if (!options.to || !options.to.includes('@')) {
      console.warn('[EmailService] Invalid recipient email address provided.');
      return {
        success: false,
        provider: 'Brevo Transactional Email API',
        error: 'Unable to send the email. Please try again later.',
        timestamp,
      };
    }

    // Step 7 & 8: Verify LIVE production key by calling GET /v3/account before sending
    try {
      const accountController = new AbortController();
      const accountTimeout = setTimeout(() => accountController.abort(), 8000);
      const accountRes = await fetch(BREVO_ACCOUNT_URL, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
        },
        signal: accountController.signal,
      });
      clearTimeout(accountTimeout);

      if (!accountRes.ok) {
        const accountErrData = await accountRes.json().catch(() => ({}));
        console.warn(`[EmailService] Brevo /v3/account verification notice (HTTP ${accountRes.status}):`, accountErrData);
        if (accountRes.status === 401) {
          console.warn('[EmailService] Notice: Brevo REST API v3 key is unauthorized or inactive. Outbound emails will fail gracefully until an active BREVO_API_KEY is configured in backend environment.');
          return {
            success: false,
            provider: 'Brevo Transactional Email API',
            error: 'Brevo API authentication rejected (HTTP 401: Key not found / unauthorized). The production environment contains an invalid/stale Brevo key.',
            statusCode: 401,
            timestamp,
          };
        }
      } else {
        console.log('[EmailService] Brevo /v3/account authentication verified: LIVE production key is active and valid.');
      }
    } catch (checkErr: any) {
      console.warn('[EmailService] Pre-flight account check notice:', this.sanitizeError(checkErr));
    }

    const payload: any = {
      sender: {
        name: this.senderName || SCHOOL_NAME_DEFAULT,
        email: this.senderEmail,
      },
      to: [
        {
          email: options.to.trim().toLowerCase(),
          ...(options.recipientName ? { name: options.recipientName.trim() } : {}),
        },
      ],
      subject: options.subject,
    };

    if (options.html) {
      payload.htmlContent = options.html;
    } else {
      payload.textContent = options.text || 'Notification from school portal';
    }
    if (Array.isArray(options.attachments) && options.attachments.length > 0) {
      payload.attachment = options.attachments.map((a) => ({ name: a.name, content: a.contentBase64 }));
    }

    try {
      console.log(`[EmailService] Dispatching transactional email via Brevo API to ${options.to.replace(/(.{2})(.*)(@.*)/, '$1***$3')} (Sender: "${this.senderName}" <${this.senderEmail}>)...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

      const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json().catch(() => ({}));

      if (response.ok && (response.status === 201 || response.status === 200)) {
        // Brevo returns a messageId when it accepts a message; none is invented if it is missing.
        const messageId = responseData.messageId || undefined;
        console.log(`[EmailService] Email accepted by Brevo for delivery (Message ID: ${messageId || 'not provided'})`);
        return {
          success: true,
          provider: 'Brevo Transactional Email API',
          messageId,
          timestamp,
        };
      }

      // Safe technical logging on backend - clearly state the actual Brevo failure
      const rawBrevoMessage = responseData.message || responseData.code || `HTTP ${response.status}`;
      console.warn(`[EmailService] [BREVO NOTICE] Brevo API responded with status ${response.status}:`, rawBrevoMessage);

      let userFacingError = rawBrevoMessage;

      if (response.status === 401) {
        console.warn(`[EmailService] [BREVO 401 NOTICE] Brevo API rejected authentication (Key not found / unauthorized).`);
        if (rawBrevoMessage.includes('unrecognised IP address') || rawBrevoMessage.includes('authorised_ips')) {
          console.warn(`[EmailService] [IP RESTRICTION BLOCKED] Brevo blocked this request because IP restriction is active on your Brevo account.`);
          console.warn(`[EmailService] [ACTION REQUIRED] Please authorize this server IP in your Brevo account (https://app.brevo.com/security/authorised_ips) or disable IP restrictions in your Brevo security settings.`);
          userFacingError = 'Email delivery rejected by Brevo: Server IP is not authorized. Please authorize the server IP at https://app.brevo.com/security/authorised_ips or disable IP restrictions in your Brevo account.';
        } else if (this.apiKey.startsWith('xsmtpsib-')) {
          console.warn(`[EmailService] [ROOT CAUSE IDENTIFIED] The configured BREVO_API_KEY begins with 'xsmtpsib-'. In Brevo, keys starting with 'xsmtpsib-' are SMTP relay credentials, NOT REST API v3 keys ('xkeysib-').`);
          console.warn(`[EmailService] [ACTION REQUIRED] Please generate a REST API v3 key in Brevo Dashboard -> Settings -> SMTP & API -> API Keys (starts with 'xkeysib-') and configure it in your environment as BREVO_API_KEY.`);
          userFacingError = 'Invalid Brevo API key: An SMTP key (xsmtpsib-) was provided instead of a REST API key (xkeysib-).';
        } else {
          console.warn(`[EmailService] [ACTION REQUIRED] Please verify that your BREVO_API_KEY is active and valid in your Brevo account dashboard.`);
          userFacingError = 'Brevo API authentication rejected (HTTP 401: Key not found / unauthorized). Please check your Brevo API key and account status.';
        }
      } else if (response.status === 400) {
        console.warn(`[EmailService] [BREVO 400 SENDER REJECTION] Brevo rejected request: ${rawBrevoMessage}`);
        console.warn(`[EmailService] [ACTION REQUIRED] Sender email "${this.senderEmail}" must be a verified sender in Brevo Dashboard -> Senders & IP.`);
        userFacingError = `Brevo rejected sender: "${this.senderEmail}" must be a verified sender in your Brevo account.`;
      }

      return {
        success: false,
        provider: 'Brevo Transactional Email API',
        error: userFacingError,
        rawBrevoMessage,
        statusCode: response.status,
        timestamp,
      };
    } catch (err: any) {
      console.warn('[EmailService] Brevo API network/dispatch error:', this.sanitizeError(err));
      return {
        success: false,
        provider: 'Brevo Transactional Email API',
        error: 'Unable to send the email. Please try again later.',
        timestamp,
      };
    }
  }

  /**
   * Diagnostic status check
   */
  public getStatus() {
    return {
      configured: this.configured,
      provider: 'Brevo Transactional Email API',
      senderEmail: this.senderEmail,
      senderName: this.senderName,
      endpoint: BREVO_API_URL,
      host: 'api.brevo.com',
      port: 443,
      tls: 'HTTPS',
      sender: `${this.senderName} <${this.senderEmail}>`,
    };
  }

  /**
   * Diagnostic environment audit
   */
  public getEnvironmentAudit() {
    return {
      provider: 'Brevo Transactional Email API',
      configured: this.configured,
      senderEmail: this.senderEmail,
      senderName: this.senderName,
      endpoint: BREVO_API_URL,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Verifies connectivity to the Brevo API by checking the account endpoint.
   * Backward-compatible with existing server diagnostic endpoints.
   */
  public async verifyActiveTransporter(): Promise<{ success: boolean; config: any; error?: string }> {
    this.reloadConfiguration();
    const config = this.getStatus();
    if (!this.configured || !this.apiKey) {
      return {
        success: false,
        config,
        error: 'Brevo Transactional Email API key (BREVO_API_KEY) is not configured in backend environment.',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(BREVO_ACCOUNT_URL, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        return {
          success: true,
          config,
        };
      }

      const body = await res.json().catch(() => ({}));
      return {
        success: false,
        config,
        error: this.sanitizeError(body.message || `HTTP ${res.status}`),
      };
    } catch (err: any) {
      return {
        success: false,
        config,
        error: this.sanitizeError(err),
      };
    }
  }

  public async verifyBrevoConnection(): Promise<{ success: boolean; config: any; error?: string }> {
    return this.verifyActiveTransporter();
  }

  // =========================================================================
  // EMAIL TEMPLATES WITH OFFICIAL SCHOOL BRANDING
  // RESIDENTIAL PDS PUBLIC SCHOOL SHEOHAR
  // BRC Near Shahpur Road, Sheohar, Bihar - 843329
  // =========================================================================

  /**
   * Shared HTML Email Layout Wrapper
   */
  private renderEmailLayout(params: {
    title: string;
    contentHtml: string;
    schoolName?: string;
    preheader?: string;
  }): string {
    const schoolName = params.schoolName || SCHOOL_NAME_DEFAULT;
    const year = new Date().getFullYear();

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${params.title}</title>
  <style type="text/css">
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    td { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    a { color: #1e3a8a; }
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; color: #1e293b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);">
          
          <!-- Header with Institutional Branding -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 32px 24px 28px 24px; color: #ffffff;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <div style="font-size: 20px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #ffffff; line-height: 1.3;">
                      ${schoolName}
                    </div>
                    <div style="margin-top: 6px; font-size: 13px; color: #cbd5e1; font-weight: 500;">
                      ${SCHOOL_ADDRESS_DEFAULT}
                    </div>
                    <div style="margin-top: 4px; font-size: 12px; color: #93c5fd; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                      School Management ERP Portal
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Gold Accent Divider -->
          <tr>
            <td style="background-color: #f59e0b; height: 4px; line-height: 4px; font-size: 0px;">&nbsp;</td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px 28px 36px 28px; color: #334155; font-size: 14px; line-height: 1.6;">
              ${params.contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 28px; font-size: 12px; color: #64748b; line-height: 1.6;">
              <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                ${schoolName}
              </div>
              <div style="margin-bottom: 8px; color: #475569;">
                ${SCHOOL_ADDRESS_DEFAULT}
              </div>
              <div style="margin-bottom: 12px; color: #64748b; font-size: 11px;">
                Official School Management Portal &bull; Automated Institutional Notification &bull; Do not reply to this email
              </div>
              <div style="color: #94a3b8; font-size: 11px;">
                &copy; ${year} ${schoolName}. All rights reserved.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
  }

  // =========================================================================
  // 1. FORGOT PASSWORD
  // =========================================================================

  /**
   * Sends password-reset email through Brevo.
   * Includes secure reset link. Reset token must remain single-use and expire after 15 minutes.
   * Never sends existing passwords by email.
   */
  public async sendPasswordResetEmail(params: {
    to: string;
    userName: string;
    resetUrl: string;
    schoolName?: string;
    expiresInMinutes?: number;
  }): Promise<EmailDispatchResult> {
    const {
      to,
      userName,
      resetUrl,
      schoolName = SCHOOL_NAME_DEFAULT,
      expiresInMinutes = 15,
    } = params;

    const subject = `Password Reset Request - ${schoolName}`;

    const contentHtml = `
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0f172a; text-align: center;">
        Password Reset Request
      </h2>

      <p style="margin: 0 0 14px 0; font-size: 15px; color: #0f172a; font-weight: 600;">
        Hello ${userName},
      </p>

      <p style="margin: 0 0 18px 0; color: #334155;">
        We received a request to reset your School Management Portal password.
      </p>

      <p style="margin: 0 0 20px 0; color: #334155; font-weight: 500;">
        Click the button below to create a new password:
      </p>

      <!-- CTA Button -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 26px 0 24px 0;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border-radius: 8px; background-color: #1e3a8a;">
                  <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 38px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.5px;">
                    RESET PASSWORD
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Fallback text link below button -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 24px 0; font-size: 12px; color: #475569; word-break: break-all;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: #1e293b;">
          If the button above does not work, copy and paste this link into your browser:
        </p>
        <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="color: #1e3a8a; text-decoration: underline; font-family: monospace;">
          ${resetUrl}
        </a>
      </div>

      <!-- Reset link expiration & Single-use notice -->
      <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 14px 16px; border-radius: 0 8px 8px 0; margin: 22px 0; font-size: 13px; color: #854d0e;">
        <p style="margin: 0 0 6px 0;"><strong>Reset link expiration:</strong> Valid for <strong>${expiresInMinutes} minutes</strong>.</p>
        <p style="margin: 0;"><strong>Single-use security:</strong> This link can only be used once to set a new password.</p>
      </div>

      <!-- Security Notice -->
      <p style="margin: 20px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">
        <strong>Security Notice:</strong> If you did not request this password reset, you can safely ignore this email. Your current password remains unchanged and secure.
      </p>
    `;

    const html = this.renderEmailLayout({
      title: subject,
      contentHtml,
      schoolName,
    });

    const text = `
${schoolName}
${SCHOOL_ADDRESS_DEFAULT}

Password Reset Request

Hello ${userName},

We received a request to reset your School Management Portal password.

Click the link below to create a new password:
${resetUrl}

Reset link expiration: Valid for ${expiresInMinutes} minutes.
Single-use security: This link can only be used once.

Security Notice: If you did not request this password reset, please ignore this message.

${schoolName}
    `.trim();

    return this.sendEmail({
      to,
      subject,
      html,
      text,
      recipientName: userName,
    });
  }

  /**
   * Password reset confirmation notice (after password has been updated).
   */
  public async sendPasswordChangedConfirmation(params: {
    to: string;
    userName: string;
    identifier: string;
    schoolName?: string;
    portalUrl: string;
  }): Promise<EmailDispatchResult> {
    const {
      to,
      userName,
      identifier,
      schoolName = SCHOOL_NAME_DEFAULT,
      portalUrl,
    } = params;

    const subject = `[${schoolName}] Security Notice: Your password has been successfully updated`;

    const contentHtml = `
      <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; margin-bottom: 20px; text-align: center;">
        &#10003; Your password has been successfully updated
      </div>

      <p style="margin: 0 0 14px 0; font-size: 15px; color: #0f172a; font-weight: 600;">
        Hello ${userName},
      </p>

      <p style="margin: 0 0 16px 0; color: #334155;">
        The password for your School Management Portal account has been changed successfully. You can now use your new password to securely sign in.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 40%;">Account User:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a;">${userName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Login ID:</td>
            <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: bold; font-size: 14px; color: #1e3a8a;">${identifier}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Updated On:</td>
            <td style="padding: 6px 0; text-align: right; color: #334155;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td>
          </tr>
        </table>
      </div>

      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center">
            <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 700; font-size: 14px;">
              Sign In to Portal &rarr;
            </a>
          </td>
        </tr>
      </table>

      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 12px; color: #92400e; margin-top: 20px;">
        <strong>Important Security Notice:</strong> If you did NOT initiate this password change, please contact the school administration immediately.
      </div>
    `;

    const html = this.renderEmailLayout({
      title: subject,
      contentHtml,
      schoolName,
    });

    const text = `
${schoolName}
Security Notice: Password Updated

Hello ${userName},

Your password has been successfully updated for account ${identifier}.

If you did not make this change, please contact school administration immediately.

Portal: ${portalUrl}
    `.trim();

    return this.sendEmail({
      to,
      subject,
      html,
      text,
      recipientName: userName,
    });
  }

  // =========================================================================
  // 2. ADMISSION / PARENT CREDENTIAL EMAIL
  // =========================================================================

  /**
   * After successful student admission/enrollment, if a valid parent email exists:
   * - Send admission confirmation through Brevo.
   * - Send the student's portal login ID/Admission Number.
   * - Send the initial portal password only if the existing system currently generates a temporary password.
   * - Clearly instruct the parent to change the password after first login.
   * - Do not expose passwords in logs.
   */
  public async sendAdmissionConfirmationEmail(params: {
    to: string;
    parentName: string;
    studentName: string;
    admissionNumber: string;
    registrationNumber?: string;
    className: string;
    section?: string;
    temporaryPassword?: string;
    portalUrl: string;
    schoolName?: string;
  }): Promise<EmailDispatchResult> {
    const {
      to,
      parentName,
      studentName,
      admissionNumber,
      registrationNumber,
      className,
      section,
      temporaryPassword,
      portalUrl,
      schoolName = SCHOOL_NAME_DEFAULT,
    } = params;

    const subject = `[${schoolName}] Admission Confirmation & Student Portal Access - ${studentName}`;

    const contentHtml = `
      <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 12px 18px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-bottom: 22px; text-align: center;">
        &#10003; Student Admission Confirmed
      </div>

      <p style="margin: 0 0 14px 0; font-size: 15px; color: #0f172a; font-weight: 600;">
        Dear ${parentName},
      </p>

      <p style="margin: 0 0 16px 0; color: #334155; line-height: 1.6;">
        We are delighted to confirm that <strong>${studentName}</strong> has been successfully admitted to <strong>${schoolName}</strong> for class <strong>${className}${section ? ` (Section ${section})` : ''}</strong>.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin: 22px 0;">
        <div style="font-size: 13px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          Student &amp; Portal Login Details
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 45%;">Student Name:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0f172a;">${studentName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Admission Number / Login ID:</td>
            <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold; font-size: 15px; color: #1e3a8a;">
              ${admissionNumber}
            </td>
          </tr>
          ${registrationNumber ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Registration Number:</td>
            <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 13px; color: #475569;">
              ${registrationNumber}
            </td>
          </tr>` : ''}
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Class / Section:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #0f172a;">${className}${section ? ` - ${section}` : ''}</td>
          </tr>
          ${temporaryPassword ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Initial Portal Password:</td>
            <td style="padding: 8px 0; text-align: right;">
              <strong style="font-family: monospace; font-size: 15px; background: #fef08a; color: #854d0e; padding: 3px 8px; border-radius: 6px; letter-spacing: 1px;">
                ${temporaryPassword}
              </strong>
            </td>
          </tr>` : ''}
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Portal Address:</td>
            <td style="padding: 8px 0; text-align: right;">
              <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="color: #1e3a8a; text-decoration: underline; font-weight: 600; font-size: 13px;">
                ${portalUrl}
              </a>
            </td>
          </tr>
        </table>
      </div>

      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center">
            <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 15px;">
              Access School Portal &rarr;
            </a>
          </td>
        </tr>
      </table>

      <!-- Instructions & Security -->
      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 0 8px 8px 0; font-size: 13px; color: #1e40af; line-height: 1.5; margin: 20px 0;">
        <strong>Portal Access Instructions:</strong><br/>
        1. Visit the portal using the link above.<br/>
        2. Parents can sign in using their registered mobile number, or students can sign in using Admission Number (<strong>${admissionNumber}</strong>).<br/>
        ${temporaryPassword ? '3. <strong>Important Security Requirement:</strong> Please change your password immediately after your first login for security.<br/>' : '3. If you have not created your portal password yet, click "Forgot Password" on the login page to set a private password.<br/>'}
      </div>

      <p style="margin: 20px 0 0 0; font-size: 13px; color: #475569;">
        Warm regards,<br/>
        <strong>Admissions Office</strong><br/>
        ${schoolName}
      </p>
    `;

    const html = this.renderEmailLayout({
      title: subject,
      contentHtml,
      schoolName,
    });

    const text = `
${schoolName}
${SCHOOL_ADDRESS_DEFAULT}

Admission Confirmation & Portal Access

Dear ${parentName},

We are pleased to confirm that ${studentName} has been admitted to ${schoolName} for ${className}${section ? ` (${section})` : ''}.

Student Name: ${studentName}
Admission Number (Login ID): ${admissionNumber}
Class: ${className}${section ? ` - ${section}` : ''}
Portal URL: ${portalUrl}
${temporaryPassword ? `Initial Password: ${temporaryPassword}\nPlease change your password immediately after your first login.` : 'Please use the Forgot Password link on the login portal to set your private password.'}

Regards,
${schoolName}
    `.trim();

    return this.sendEmail({
      to,
      subject,
      html,
      text,
      recipientName: parentName,
    });
  }

  // =========================================================================
  // 3. STAFF ACCOUNT EMAIL
  // =========================================================================

  /**
   * When an admin creates a new staff account:
   * - Send the staff portal login ID/username and temporary password to the staff member's registered email through Brevo.
   * - Instruct them to change the password after first login.
   * - Never log or expose the password.
   */
  public async sendStaffWelcomeCredentialsEmail(params: {
    to: string;
    staffName: string;
    employeeId: string;
    portalUserId: string;
    roleName: string;
    temporaryPassword: string;
    portalUrl: string;
    schoolName?: string;
  }): Promise<EmailDispatchResult> {
    const {
      to,
      staffName,
      employeeId,
      portalUserId,
      roleName,
      temporaryPassword,
      portalUrl,
      schoolName = SCHOOL_NAME_DEFAULT,
    } = params;

    const subject = `[${schoolName}] Welcome to Faculty & Staff Portal - Your Login Credentials`;

    const contentHtml = `
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 12px 18px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-bottom: 20px; text-align: center;">
        Welcome to the Institutional Faculty &amp; Staff Team
      </div>

      <p style="margin: 0 0 14px 0; font-size: 15px; color: #0f172a; font-weight: 600;">
        Dear ${staffName},
      </p>

      <p style="margin: 0 0 16px 0; color: #334155; line-height: 1.6;">
        Your institutional staff account at <strong>${schoolName}</strong> has been provisioned. You can now access your staff portal dashboard using the credentials below:
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 40%;">Employee ID:</td>
            <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold; font-size: 15px; color: #0f172a;">${employeeId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Portal Login ID:</td>
            <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold; font-size: 15px; color: #1e3a8a;">${portalUserId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Assigned Role:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0f172a;">${roleName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Temporary Password:</td>
            <td style="padding: 8px 0; text-align: right;">
              <strong style="font-family: monospace; font-size: 15px; background: #fef08a; color: #854d0e; padding: 3px 8px; border-radius: 6px; letter-spacing: 1px;">
                ${temporaryPassword}
              </strong>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Portal URL:</td>
            <td style="padding: 8px 0; text-align: right;">
              <a href="${portalUrl}" style="color: #1e3a8a; text-decoration: underline; font-size: 13px;">${portalUrl}</a>
            </td>
          </tr>
        </table>
      </div>

      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center">
            <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 15px;">
              Log In to Staff Portal &rarr;
            </a>
          </td>
        </tr>
      </table>

      <!-- Security Notice -->
      <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 14px 16px; border-radius: 0 8px 8px 0; font-size: 13px; color: #854d0e; line-height: 1.5; margin: 20px 0;">
        <strong>Mandatory Security Requirement:</strong> Please log in and change your temporary password immediately upon your first login. Do not share your login credentials with anyone.
      </div>

      <p style="margin: 20px 0 0 0; font-size: 13px; color: #475569;">
        Regards,<br/>
        <strong>Administration &amp; HR Department</strong><br/>
        ${schoolName}
      </p>
    `;

    const html = this.renderEmailLayout({
      title: subject,
      contentHtml,
      schoolName,
    });

    const text = `
${schoolName}
${SCHOOL_ADDRESS_DEFAULT}

Staff Portal Credentials

Dear ${staffName},

Your staff account has been created.

Employee ID: ${employeeId}
Login ID: ${portalUserId}
Role: ${roleName}
Temporary Password: ${temporaryPassword}
Portal URL: ${portalUrl}

Please log in and change your password immediately after first login.

Regards,
${schoolName}
    `.trim();

    return this.sendEmail({
      to,
      subject,
      html,
      text,
      recipientName: staffName,
    });
  }

  /**
   * Dispatches official staff portal login credentials containing the member's actual Login ID,
   * ERP Portal URL, and a secure password setup / reset link (No plaintext passwords).
   */
  public async sendStaffCredentialsWithResetLink(params: {
    to: string;
    staffName: string;
    employeeId: string;
    portalUserId: string;
    roleName: string;
    portalUrl: string;
    resetUrl: string;
    schoolName?: string;
    expiresInMinutes?: number;
  }): Promise<EmailDispatchResult> {
    const {
      to,
      staffName,
      employeeId,
      portalUserId,
      roleName,
      portalUrl,
      resetUrl,
      schoolName = SCHOOL_NAME_DEFAULT,
      expiresInMinutes = 60,
    } = params;

    const subject = `[${schoolName}] Staff Portal Credentials & Secure Password Setup`;

    const contentHtml = `
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 12px 18px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-bottom: 20px; text-align: center;">
        Institutional Faculty &amp; Staff Account Verified
      </div>

      <p style="margin: 0 0 14px 0; font-size: 15px; color: #0f172a; font-weight: 600;">
        Dear ${staffName},
      </p>

      <p style="margin: 0 0 16px 0; color: #334155; line-height: 1.6;">
        Your official institutional staff account at <strong>${schoolName}</strong> has been configured. Below are your verified portal access credentials and a secure link to activate your account and set your password:
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 40%;">Employee ID:</td>
            <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold; font-size: 15px; color: #0f172a;">${employeeId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">ERP Login ID / Username:</td>
            <td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold; font-size: 15px; color: #1e3a8a;">${portalUserId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Assigned Role:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0f172a;">${roleName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">ERP Portal URL:</td>
            <td style="padding: 8px 0; text-align: right;">
              <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="color: #1e3a8a; text-decoration: underline; font-size: 13px;">${portalUrl}</a>
            </td>
          </tr>
        </table>
      </div>

      <p style="margin: 20px 0 10px 0; color: #334155; font-size: 14px; text-align: center;">
        Click the button below to verify your account and set your confidential password:
      </p>

      <!-- CTA Button -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0 24px 0;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border-radius: 8px; background-color: #1e3a8a;">
                  <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 38px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.5px;">
                    ACTIVATE ACCOUNT &amp; SET PASSWORD &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Security Notice -->
      <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 14px 16px; border-radius: 0 8px 8px 0; font-size: 13px; color: #854d0e; line-height: 1.5; margin: 20px 0;">
        <strong>Security &amp; Privacy Assurance:</strong> For institutional data protection, passwords are never transmitted in plaintext. This secure single-use activation link expires in ${expiresInMinutes} minutes. If you did not request this email, please notify the School Administration immediately.
      </div>

      <p style="margin: 20px 0 0 0; font-size: 13px; color: #475569;">
        Regards,<br/>
        <strong>Administration &amp; HR Department</strong><br/>
        ${schoolName}
      </p>
    `;

    const html = this.renderEmailLayout({
      title: subject,
      contentHtml,
      schoolName,
    });

    const text = `
${schoolName}
Staff Portal Credentials & Secure Password Setup

Dear ${staffName},

Your staff account has been configured.

Employee ID: ${employeeId}
Portal Login ID: ${portalUserId}
Role: ${roleName}
ERP Portal URL: ${portalUrl}

Please use the secure link below to set your password (valid for ${expiresInMinutes} minutes):
${resetUrl}

For security, passwords are never sent in plaintext.

Regards,
Administration & HR Department
${schoolName}
    `.trim();

    return this.sendEmail({
      to,
      subject,
      html,
      text,
      recipientName: staffName,
    });
  }

  // =========================================================================
  // 4. ADMIN PASSWORD RESET (TEMPORARY PASSWORD)
  // =========================================================================

  /**
   * When an administrator resets a user's password:
   * - Update the bcrypt password hash in MongoDB immediately (handled in caller).
   * - Send the temporary/new password through Brevo only when this workflow requires it.
   * - Never store plaintext passwords in MongoDB or logs.
   */
  public async sendTemporaryPasswordEmail(params: {
    to: string;
    userName: string;
    roleName: string;
    identifier: string;
    temporaryPassword: string;
    portalUrl: string;
    schoolName?: string;
  }): Promise<EmailDispatchResult> {
    const {
      to,
      userName,
      roleName,
      identifier,
      temporaryPassword,
      portalUrl,
      schoolName = SCHOOL_NAME_DEFAULT,
    } = params;

    const subject = `[${schoolName}] Temporary Password Issued for Your Account`;

    const contentHtml = `
      <div style="background-color: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 12px 18px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-bottom: 20px; text-align: center;">
        Administrative Password Reset
      </div>

      <p style="margin: 0 0 14px 0; font-size: 15px; color: #0f172a; font-weight: 600;">
        Hello ${userName},
      </p>

      <p style="margin: 0 0 16px 0; color: #334155;">
        A new temporary password has been issued for your <strong>${schoolName}</strong> ERP portal account.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 40%;">Account User:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a;">${userName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Role:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1e3a8a;">${roleName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Login User ID:</td>
            <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: bold; font-size: 14px; color: #0f172a;">${identifier}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Issued On:</td>
            <td style="padding: 6px 0; text-align: right; color: #334155;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td>
          </tr>
        </table>
      </div>

      <!-- Temporary Password Box -->
      <div style="background-color: #fefce8; border: 2px dashed #ca8a04; border-radius: 12px; padding: 20px; text-align: center; margin: 22px 0;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #854d0e; letter-spacing: 0.5px; margin-bottom: 8px;">
          Your Temporary Password
        </div>
        <div style="font-family: monospace; font-size: 24px; font-weight: 700; color: #854d0e; letter-spacing: 2px;">
          ${temporaryPassword}
        </div>
        <p style="font-size: 12px; color: #713f12; margin: 10px 0 0 0; font-weight: 500;">
          Use this password to log in and update your password immediately.
        </p>
      </div>

      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center">
            <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 15px;">
              Sign In Now &rarr;
            </a>
          </td>
        </tr>
      </table>

      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 12px; color: #92400e; margin-top: 20px;">
        <strong>Security Notice:</strong> Please change this temporary password immediately after logging in.
      </div>
    `;

    const html = this.renderEmailLayout({
      title: subject,
      contentHtml,
      schoolName,
    });

    const text = `
${schoolName}
Administrative Password Reset

Hello ${userName},

A new temporary password has been issued for your account.

Login ID: ${identifier}
Temporary Password: ${temporaryPassword}
Portal URL: ${portalUrl}

Please sign in and change your password immediately.

${schoolName}
    `.trim();

    return this.sendEmail({
      to,
      subject,
      html,
      text,
      recipientName: userName,
    });
  }

  /**
   * General account welcome email.
   */
  public async sendAccountWelcomeEmail(params: {
    to: string;
    userName: string;
    roleName: string;
    identifier: string;
    temporaryPassword?: string;
    portalUrl: string;
    schoolName?: string;
    instructions?: string;
  }): Promise<EmailDispatchResult> {
    const {
      to,
      userName,
      roleName,
      identifier,
      temporaryPassword,
      portalUrl,
      schoolName = SCHOOL_NAME_DEFAULT,
      instructions,
    } = params;

    const subject = `[${schoolName}] Welcome! Your Portal Login Details (${identifier})`;

    const contentHtml = `
      <p style="margin: 0 0 14px 0; font-size: 15px; color: #0f172a; font-weight: 600;">
        Dear ${userName},
      </p>

      <p style="margin: 0 0 16px 0; color: #334155;">
        Your institutional portal account as <strong>${roleName}</strong> at <strong>${schoolName}</strong> has been provisioned.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 40%;">Portal Address:</td>
            <td style="padding: 6px 0; text-align: right;"><a href="${portalUrl}" style="color: #1e3a8a; text-decoration: none; font-weight: 600;">Open Portal</a></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">User / Login ID:</td>
            <td style="padding: 6px 0; text-align: right;"><strong style="font-family: monospace; font-size: 14px; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${identifier}</strong></td>
          </tr>
          ${temporaryPassword ? `
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Initial Password:</td>
            <td style="padding: 6px 0; text-align: right;"><strong style="font-family: monospace; font-size: 14px; background: #fef08a; color: #854d0e; padding: 2px 6px; border-radius: 4px;">${temporaryPassword}</strong></td>
          </tr>` : ''}
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Assigned Role:</td>
            <td style="padding: 6px 0; text-align: right;"><strong>${roleName}</strong></td>
          </tr>
        </table>
      </div>

      ${instructions ? `<p style="font-size: 13px; color: #475569; background: #f8fafc; padding: 12px; border-radius: 8px;">${instructions}</p>` : ''}

      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center">
            <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Access School Portal &rarr;
            </a>
          </td>
        </tr>
      </table>
    `;

    const html = this.renderEmailLayout({
      title: subject,
      contentHtml,
      schoolName,
    });

    return this.sendEmail({
      to,
      subject,
      html,
      recipientName: userName,
    });
  }
}

export const emailService = new EmailService();

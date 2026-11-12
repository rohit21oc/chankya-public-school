import 'dotenv/config';
import { SmsLogModel, type SmsTriggerType, type SmsStatus } from '../models/SmsLog.ts';

export interface SmsSendOptions {
  recipientPhone: string;
  recipientName: string;
  recipientRole?: 'PARENT' | 'STUDENT' | 'STAFF';
  studentId?: string;
  studentName?: string;
  admissionNumber?: string;
  className?: string;
  section?: string;
  message: string;
  triggerType: SmsTriggerType;
  idempotencyKey: string;
  sentBy?: string;
  sentByUserId?: string;
}

export interface SmsDispatchResult {
  success: boolean;
  logId?: string;
  provider: string;
  providerMessageId?: string;
  status: SmsStatus;
  isDuplicate?: boolean;
  error?: string;
  sentAt: string;
  phone: string;
  recipientName: string;
}

export interface SmsBatchDispatchResult {
  total: number;
  sent: number;
  failed: number;
  duplicatesSkipped: number;
  results: SmsDispatchResult[];
}

export class SmsService {
  private defaultProvider = 'PDS_SMS_GATEWAY';
  // Read on use so values loaded from .env after this module is imported are honoured.
  private get apiKey(): string {
    return process.env.SMS_API_KEY || '';
  }
  private get senderId(): string {
    return process.env.SMS_SENDER_ID || 'PDSSHR';
  }

  /**
   * True only when a real SMS gateway is set up (SMS_PROVIDER=FAST2SMS and SMS_API_KEY).
   * Without it no message can leave the server, so nothing is reported as sent.
   */
  public isConfigured(): boolean {
    return Boolean(this.apiKey) && String(process.env.SMS_PROVIDER || '').toUpperCase() === 'FAST2SMS';
  }

  public notConfiguredMessage(): string {
    return 'SMS is not set up on the server yet, so no message was sent. Add SMS_PROVIDER=FAST2SMS and SMS_API_KEY in the server settings.';
  }

  /**
   * Normalizes an Indian phone number to 10 digits.
   * Strips spaces, hyphens, "+91", or leading "0".
   */
  public normalizePhone(phone?: string | null): string {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      return digits.slice(2);
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return digits.slice(1);
    }
    if (digits.length === 10) {
      return digits;
    }
    // Return last 10 digits if longer
    if (digits.length > 10) {
      return digits.slice(-10);
    }
    return digits;
  }

  /**
   * Validates if a phone number is a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).
   */
  public isValidIndianMobile(phone: string): boolean {
    const clean = this.normalizePhone(phone);
    return /^[6-9]\d{9}$/.test(clean);
  }

  /**
   * Calculates SMS credit units (1 unit per 160 characters for standard GSM).
   */
  public calculateUnits(message: string): number {
    const len = message?.length || 0;
    if (len === 0) return 0;
    return Math.max(1, Math.ceil(len / 160));
  }

  /**
   * Dispatches a single SMS with strict duplicate-send prevention using idempotencyKey.
   */
  public async sendSms(options: SmsSendOptions): Promise<SmsDispatchResult> {
    const cleanPhone = this.normalizePhone(options.recipientPhone);
    const sentAt = new Date().toISOString();
    const dateStr = sentAt.substring(0, 10);
    const charCount = options.message?.length || 0;
    const units = this.calculateUnits(options.message);

    // 1. Validate mobile number
    if (!this.isValidIndianMobile(cleanPhone)) {
      const failedResult: SmsDispatchResult = {
        success: false,
        provider: this.defaultProvider,
        status: 'FAILED',
        error: `Invalid 10-digit mobile number: "${options.recipientPhone}". Must be a valid Indian mobile number.`,
        sentAt,
        phone: cleanPhone || options.recipientPhone,
        recipientName: options.recipientName,
      };

      // Persist failed attempt to MongoDB
      try {
        const failId = `sms-fail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await SmsLogModel.create({
          id: failId,
          sentAt,
          date: dateStr,
          triggerType: options.triggerType,
          recipientPhone: options.recipientPhone,
          recipientName: options.recipientName,
          recipientRole: options.recipientRole || 'PARENT',
          studentId: options.studentId,
          studentName: options.studentName,
          admissionNumber: options.admissionNumber,
          className: options.className,
          section: options.section,
          message: options.message,
          characterCount: charCount,
          smsUnits: units,
          provider: this.defaultProvider,
          status: 'FAILED',
          errorReason: failedResult.error,
          idempotencyKey: options.idempotencyKey,
          sentBy: options.sentBy || 'Administration',
          sentByUserId: options.sentByUserId,
        });
      } catch {
        // Ignore duplicate failure log
      }

      return failedResult;
    }

    // 2. No gateway configured: report the failure honestly instead of logging a fake submission.
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: 'NOT_CONFIGURED',
        status: 'FAILED',
        error: this.notConfiguredMessage(),
        sentAt,
        phone: cleanPhone,
        recipientName: options.recipientName,
      };
    }

    // 3. Strict Server-Side Idempotency Check in MongoDB
    // Prevents double-sending due to page refresh, re-login, server restart, API retry, or cron re-run.
    try {
      const existingLog = await SmsLogModel.findOne({ idempotencyKey: options.idempotencyKey }).lean();
      if (existingLog) {
        if (
          existingLog.status === 'SUBMITTED' ||
          existingLog.status === 'SENT' ||
          existingLog.status === 'DELIVERED'
        ) {
          return {
            success: true,
            logId: existingLog.id,
            provider: existingLog.provider,
            providerMessageId: existingLog.providerMessageId,
            status: existingLog.status,
            isDuplicate: true,
            sentAt: existingLog.sentAt,
            phone: cleanPhone,
            recipientName: options.recipientName,
          };
        }
      }
    } catch (dbErr: any) {
      console.warn('[SmsService] Error checking idempotency in MongoDB:', dbErr?.message);
    }

    // 3. Dispatch to Gateway
    let gatewaySuccess = false;
    let providerMessageId = `PDS-SMS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    let activeProvider = this.defaultProvider;
    let gatewayError: string | undefined = undefined;

    // Check if Fast2SMS or external gateway is configured
    if (this.isConfigured()) {
      try {
        activeProvider = 'FAST2SMS';
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'v3',
            sender_id: this.senderId,
            message: options.message,
            language: 'english',
            flash: 0,
            numbers: cleanPhone,
          }),
        });

        const data: any = await response.json().catch(() => ({}));
        if (response.ok && data?.return === true) {
          gatewaySuccess = true;
          providerMessageId = data.request_id || providerMessageId;
        } else {
          gatewaySuccess = false;
          gatewayError = data?.message?.[0] || data?.message || `Fast2SMS HTTP ${response.status}`;
        }
      } catch (apiErr: any) {
        gatewaySuccess = false;
        gatewayError = apiErr?.message || 'Network error reaching SMS gateway';
      }
    }

    const logId = `sms-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    // Provider only confirms submission/acceptance at this stage. Delivery confirmation requires DLR/webhook.
    const finalStatus: SmsStatus = gatewaySuccess ? 'SUBMITTED' : 'FAILED';

    // 4. Save Record in MongoDB Atlas atomically
    try {
      await SmsLogModel.findOneAndUpdate(
        { idempotencyKey: options.idempotencyKey },
        {
          $setOnInsert: {
            id: logId,
            sentAt,
            date: dateStr,
            triggerType: options.triggerType,
            recipientPhone: cleanPhone,
            recipientName: options.recipientName,
            recipientRole: options.recipientRole || 'PARENT',
            studentId: options.studentId,
            studentName: options.studentName,
            admissionNumber: options.admissionNumber,
            className: options.className,
            section: options.section,
            message: options.message,
            characterCount: charCount,
            smsUnits: units,
            provider: activeProvider,
            providerMessageId,
            status: finalStatus,
            errorReason: gatewayError,
            idempotencyKey: options.idempotencyKey,
            sentBy: options.sentBy || 'Administration',
            sentByUserId: options.sentByUserId,
          },
        },
        { upsert: true, new: true }
      );
    } catch (saveErr: any) {
      if (saveErr?.code === 11000) {
        // Handled race condition: duplicate key was inserted concurrently
        return {
          success: true,
          provider: activeProvider,
          status: 'SUBMITTED',
          isDuplicate: true,
          sentAt,
          phone: cleanPhone,
          recipientName: options.recipientName,
        };
      }
      console.error('[SmsService] Error saving SMS log to MongoDB:', saveErr);
    }

    return {
      success: gatewaySuccess,
      logId,
      provider: activeProvider,
      providerMessageId,
      status: finalStatus,
      error: gatewayError,
      sentAt,
      phone: cleanPhone,
      recipientName: options.recipientName,
    };
  }

  /**
   * Updates delivery status from external DLR webhook or callback.
   */
  public async handleDlrWebhook(payload: {
    request_id?: string;
    message_id?: string;
    idempotency_key?: string;
    status: 'DELIVERED' | 'FAILED' | 'SUBMITTED' | 'SENT';
    delivered_at?: string;
    phone?: string;
    error?: string;
  }): Promise<{ updated: boolean; log: any }> {
    const query: any = {};
    if (payload.request_id || payload.message_id) {
      query.providerMessageId = payload.request_id || payload.message_id;
    } else if (payload.idempotency_key) {
      query.idempotencyKey = payload.idempotency_key;
    } else {
      return { updated: false, log: null };
    }

    const update: any = {
      status: payload.status,
    };
    if (payload.status === 'DELIVERED') {
      update.deliveredAt = payload.delivered_at || new Date().toISOString();
    }
    if (payload.error) {
      update.errorReason = payload.error;
    }

    const updatedDoc = await SmsLogModel.findOneAndUpdate(query, { $set: update }, { new: true }).lean();
    return { updated: Boolean(updatedDoc), log: updatedDoc };
  }

  /**
   * Checks delivery status for a specific SMS log record against the provider or updates appropriately.
   */
  public async checkDeliveryStatus(logIdOrMessageId: string): Promise<{
    success: boolean;
    status: SmsStatus;
    provider: string;
    message: string;
    log?: any;
  }> {
    const log = await SmsLogModel.findOne({
      $or: [{ id: logIdOrMessageId }, { providerMessageId: logIdOrMessageId }],
    }).lean();

    if (!log) {
      return {
        success: false,
        status: 'UNKNOWN',
        provider: this.defaultProvider,
        message: 'SMS log not found in database.',
      };
    }

    if (log.status === 'DELIVERED') {
      return {
        success: true,
        status: 'DELIVERED',
        provider: log.provider,
        message: `Carrier delivery verified on ${log.deliveredAt || log.sentAt}.`,
        log,
      };
    }

    if (log.status === 'FAILED') {
      return {
        success: true,
        status: 'FAILED',
        provider: log.provider,
        message: log.errorReason || 'Transmission failed at gateway.',
        log,
      };
    }

    // If Fast2SMS is active and API key exists, query provider status
    if (this.apiKey && log.provider === 'FAST2SMS' && log.providerMessageId) {
      try {
        const res = await fetch(`https://www.fast2sms.com/dev/status?request_id=${log.providerMessageId}`, {
          headers: { authorization: this.apiKey },
        });
        if (res.ok) {
          const data: any = await res.json().catch(() => ({}));
          const providerStatus = (data?.status || data?.state || '').toUpperCase();
          if (providerStatus === 'DELIVERED' || providerStatus === 'SUCCESS') {
            const updated = await SmsLogModel.findOneAndUpdate(
              { id: log.id },
              { $set: { status: 'DELIVERED', deliveredAt: new Date().toISOString() } },
              { new: true }
            ).lean();
            return {
              success: true,
              status: 'DELIVERED',
              provider: log.provider,
              message: 'Carrier delivery confirmed by Fast2SMS DLR.',
              log: updated,
            };
          }
        }
      } catch (e: any) {
        console.warn('[SmsService] Fast2SMS status check error:', e?.message);
      }
    }

    return {
      success: true,
      status: log.status as SmsStatus,
      provider: log.provider,
      message:
        log.status === 'SUBMITTED'
          ? 'Message was accepted by SMS gateway. Carrier delivery report pending.'
          : `Current status is ${log.status}.`,
      log,
    };
  }

  /**
   * Batch dispatches SMS messages sequentially with duplicate filtering.
   */
  public async sendBatchSms(optionsList: SmsSendOptions[]): Promise<SmsBatchDispatchResult> {
    const results: SmsDispatchResult[] = [];
    let sent = 0;
    let failed = 0;
    let duplicatesSkipped = 0;

    for (const opt of optionsList) {
      const res = await this.sendSms(opt);
      results.push(res);
      if (res.isDuplicate) {
        duplicatesSkipped++;
      } else if (res.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return {
      total: optionsList.length,
      sent,
      failed,
      duplicatesSkipped,
      results,
    };
  }

  /**
   * Retrieves summary metrics for the SMS gateway.
   */
  public async getStats(): Promise<{
    todaySent: number;
    todayFailed: number;
    totalSent: number;
    totalFailed: number;
    activeProvider: string;
    senderId: string;
    configured: boolean;
    /** False when the SMS log store could not be read; the counts are then unknown, not zero. */
    countsAvailable: boolean;
  }> {
    const todayStr = new Date().toISOString().substring(0, 10);
    try {
      const [todaySent, todayFailed, totalSent, totalFailed] = await Promise.all([
        SmsLogModel.countDocuments({ date: todayStr, status: { $in: ['SUBMITTED', 'SENT', 'DELIVERED'] } }),
        SmsLogModel.countDocuments({ date: todayStr, status: 'FAILED' }),
        SmsLogModel.countDocuments({ status: { $in: ['SUBMITTED', 'SENT', 'DELIVERED'] } }),
        SmsLogModel.countDocuments({ status: 'FAILED' }),
      ]);

      return {
        todaySent,
        todayFailed,
        totalSent,
        totalFailed,
        activeProvider: this.isConfigured() ? 'FAST2SMS' : 'NOT_CONFIGURED',
        senderId: this.senderId,
        configured: this.isConfigured(),
        countsAvailable: true,
      };
    } catch (e: any) {
      console.warn('[SmsService] Error querying stats from MongoDB:', e?.message);
      return {
        todaySent: 0,
        todayFailed: 0,
        totalSent: 0,
        totalFailed: 0,
        activeProvider: this.isConfigured() ? 'FAST2SMS' : 'NOT_CONFIGURED',
        senderId: this.senderId,
        configured: this.isConfigured(),
        countsAvailable: false,
      };
    }
  }
}

export const smsService = new SmsService();

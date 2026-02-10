export type DashboardAttachment = {
  filename: string;
  mimeType: string;
  storageUrl?: string;
};

export type DashboardMessage = {
  id: string;
  _id?: string;
  messageId?: string;
  threadId?: string;
  subject?: string;
  from?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  date?: string;
  mailedBy?: string;
  signedBy?: string;
  security?: string;
  headers?: Record<string, string>;
  body?: string;
  snippet?: string;
  category?: string;
  accountEmail?: string;
  attachments?: DashboardAttachment[];
  threadAttachmentCount?: number;
  unreadCount?: number;
  isRead?: boolean;
  aiExplanation?: string;
  priority?: boolean;
  billDue?: boolean;
  hidden?: boolean;
  starred?: boolean;
  createdAt?: string;
  count?: number;
};

export type DashboardThread = {
  messages?: DashboardMessage[];
  threadId?: string;
  account?: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    storageUrl?: string;
    messageId?: string;
    emailId?: string;
  }>;
  threadAttachmentCount?: number;
};

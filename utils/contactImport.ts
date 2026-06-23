const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeContactEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function extractEmailsFromVCard(content: string): string[] {
  const emails = new Set<string>();

  for (const match of content.matchAll(/EMAIL[^:\r\n]*:([^\s;\r\n]+)/gi)) {
    const normalized = normalizeContactEmail(match[1] ?? '');
    if (normalized) emails.add(normalized);
  }

  return [...emails];
}

export function parseEmailList(input: string): string[] {
  return [...new Set(
    input
      .split(/[\s,;]+/)
      .map((email) => normalizeContactEmail(email))
      .filter((email): email is string => !!email),
  )];
}

export type ContactImportErrorCode =
  | 'permission_denied'
  | 'unsupported'
  | 'no_emails'
  | 'cancelled';

export interface ContactImportResult {
  emails: string[];
  errorCode?: ContactImportErrorCode;
  message?: string;
}

type ContactPickerEmail = { address?: string };
type ContactPickerContact = { email?: ContactPickerEmail[] | string[] };

interface ContactsManager {
  select(properties: string[], options?: { multiple?: boolean }): Promise<ContactPickerContact[]>;
}

declare global {
  interface Navigator {
    contacts?: ContactsManager;
  }
}

function collectEmailsFromPickerContacts(contacts: ContactPickerContact[]): string[] {
  const emails = new Set<string>();

  for (const contact of contacts) {
    for (const entry of contact.email ?? []) {
      const raw = typeof entry === 'string' ? entry : entry.address ?? '';
      const normalized = normalizeContactEmail(raw);
      if (normalized) emails.add(normalized);
    }
  }

  return [...emails];
}

async function importWebContactPickerEmails(): Promise<ContactImportResult> {
  if (typeof navigator === 'undefined' || !navigator.contacts?.select) {
    return {
      emails: [],
      errorCode: 'unsupported',
      message: 'Choose a contacts file (.vcf) instead.',
    };
  }

  try {
    const contacts = await navigator.contacts.select(['email'], { multiple: true });
    const emails = collectEmailsFromPickerContacts(contacts);
    if (emails.length === 0) {
      return {
        emails: [],
        errorCode: 'no_emails',
        message: 'No email addresses were found in the contacts you selected.',
      };
    }
    return { emails };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'InvalidStateError' || name === 'AbortError') {
      return { emails: [], errorCode: 'cancelled' };
    }
    return {
      emails: [],
      errorCode: 'unsupported',
      message: 'Choose a contacts file (.vcf) instead.',
    };
  }
}

async function importNativeContactEmails(): Promise<ContactImportResult> {
  const Contacts = await import('expo-contacts/legacy');
  const { status } = await Contacts.requestPermissionsAsync();

  if (status !== 'granted') {
    return {
      emails: [],
      errorCode: 'permission_denied',
      message: 'Allow contacts access in Settings to import friends from your address book.',
    };
  }

  const emails = new Set<string>();
  let pageOffset = 0;
  const pageSize = 500;

  while (true) {
    const page = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Emails],
      pageSize,
      pageOffset,
    });

    for (const contact of page.data) {
      for (const entry of contact.emails ?? []) {
        const normalized = normalizeContactEmail(entry.email ?? '');
        if (normalized) emails.add(normalized);
      }
    }

    if (!page.hasNextPage || page.data.length === 0) break;
    pageOffset += page.data.length;
  }

  const list = [...emails];
  if (list.length === 0) {
    return {
      emails: [],
      errorCode: 'no_emails',
      message: 'No email addresses were found in your contacts.',
    };
  }

  return { emails: list };
}

export async function importContactEmails(): Promise<ContactImportResult> {
  const { Platform } = await import('react-native');

  if (Platform.OS === 'web') {
    return importWebContactPickerEmails();
  }

  return importNativeContactEmails();
}

export async function importContactEmailsFromVCardText(content: string): Promise<ContactImportResult> {
  const emails = extractEmailsFromVCard(content);
  if (emails.length === 0) {
    return {
      emails: [],
      errorCode: 'no_emails',
      message: 'No email addresses were found in that contacts file.',
    };
  }
  return { emails };
}

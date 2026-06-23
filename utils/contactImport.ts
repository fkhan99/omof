import { Platform } from 'react-native';

type ContactPickerEmail = { address?: string };
type ContactPickerContact = { email?: ContactPickerEmail[] };

interface ContactsManager {
  select(properties: string[], options?: { multiple?: boolean }): Promise<ContactPickerContact[]>;
}

declare global {
  interface Navigator {
    contacts?: ContactsManager;
  }
}

export async function importContactEmails(): Promise<string[]> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.contacts?.select) {
    try {
      const contacts = await navigator.contacts.select(['email'], { multiple: true });
      return contacts
        .flatMap((contact) => contact.email ?? [])
        .map((entry) => entry.address?.trim().toLowerCase() ?? '')
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  return [];
}

export function parseEmailList(input: string): string[] {
  return [...new Set(
    input
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
  )];
}

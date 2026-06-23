import { useRef } from 'react';
import { Platform } from 'react-native';

type WebFileInput = HTMLInputElement;

export function useContactsFilePicker(onFileText: (text: string) => void) {
  const inputRef = useRef<WebFileInput | null>(null);

  const openPicker = () => {
    inputRef.current?.click();
  };

  const input =
    Platform.OS === 'web' ? (
      <input
        ref={inputRef}
        type="file"
        accept=".vcf,.vcard,text/vcard,text/x-vcard"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;

          void file.text().then((text) => {
            onFileText(text);
          });
        }}
      />
    ) : null;

  return { openPicker, input };
}

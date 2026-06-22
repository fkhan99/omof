import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const PROFILE_PHOTO_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  aspect: [1, 1],
  quality: 1,
  ...(Platform.OS === 'ios'
    ? {
        allowsEditing: false,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
        shouldDownloadFromNetwork: true,
      }
    : {
        allowsEditing: true,
      }),
};

export async function pickProfilePhotoFromLibrary(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Permission needed',
      'Allow photo library access to choose a profile photo.',
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync(PROFILE_PHOTO_PICKER_OPTIONS);
  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  return result.assets[0].uri;
}

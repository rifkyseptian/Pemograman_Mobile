import { recognizeText } from 'expo-ocr-kit';

export async function recognizeScheduleText(imageUri: string): Promise<string> {
  const result = await recognizeText(imageUri);
  return result.text.trim();
}

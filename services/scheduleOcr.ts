/** Platform-specific OCR implementations live in scheduleOcr.web.ts and scheduleOcr.native.ts. */
export async function recognizeScheduleText(_imageUri: string): Promise<string> {
  throw new Error('Pemindaian teks tidak tersedia pada platform ini.');
}

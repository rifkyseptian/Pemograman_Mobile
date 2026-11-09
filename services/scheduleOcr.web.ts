import { createWorker } from 'tesseract.js';

export async function recognizeScheduleText(imageUri: string): Promise<string> {
  const worker = await createWorker('ind');
  try {
    const result = await worker.recognize(imageUri);
    return result.data.text.trim();
  } finally {
    await worker.terminate();
  }
}

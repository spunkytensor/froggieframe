import { generateObject } from 'ai';
import sharp from 'sharp';
import { geminiFlash } from './client';
import { photoAnalysisSchema, type PhotoAnalysis } from './schemas';

const MAX_IMAGE_DIMENSION = 1536;

const ANALYSIS_PROMPT = `Analyze this photo and provide:

1. TAGS: Identify and categorize elements in the image:
   - person: people, family, friends, pets (dogs, cats, etc.)
   - place: locations like beach, mountain, city, home, park, restaurant, garden
   - object: notable items like car, food, cake, flower, book, furniture, art
   - event: occasions like birthday, wedding, vacation, holiday, graduation, party

2. MOOD: Determine the overall emotional/aesthetic feel:
   - calmer: peaceful, serene, quiet scenes
   - darker: moody, dramatic, low-light scenes
   - vibrant: colorful, lively, high-energy scenes
   - relaxing: comfortable, cozy, leisure scenes
   - energetic: action, movement, excitement
   - neutral: everyday, standard scenes

Provide confidence scores (0-1) for each tag and mood.
Only include tags with confidence >= 0.6.
Be specific with tags but keep them concise (1-2 words max).`;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAndResizeImage(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);
  
  // Resize if larger than MAX_IMAGE_DIMENSION, preserving aspect ratio
  const resizedBuffer = await sharp(inputBuffer)
    .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg()
    .toBuffer();
  
  const base64 = resizedBuffer.toString('base64');
  
  return { data: base64, mimeType: 'image/jpeg' };
}

export async function analyzePhoto(imageUrl: string): Promise<PhotoAnalysis> {
  let lastError: Error | null = null;

  const { data: imageData, mimeType } = await fetchAndResizeImage(imageUrl);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { object } = await generateObject({
        model: geminiFlash,
        schema: photoAnalysisSchema,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: ANALYSIS_PROMPT },
              { type: 'image', image: `data:${mimeType};base64,${imageData}` },
            ],
          },
        ],
      });

      return object;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Log detailed error info for debugging gateway issues
      console.error(`AI analysis attempt ${attempt} error details:`, {
        message: lastError.message,
        name: lastError.name,
        cause: (lastError as Error & { cause?: unknown }).cause,
        stack: lastError.stack?.split('\n').slice(0, 3).join('\n'),
        imageSize: `${(imageData.length / 1024 / 1024).toFixed(2)}MB base64`,
        mimeType,
      });
      
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`AI analysis attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error('AI analysis failed after all retries');
}

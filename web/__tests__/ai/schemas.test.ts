import { photoAnalysisSchema } from '@/lib/ai/schemas';

describe('photoAnalysisSchema', () => {
  it('should validate a correct photo analysis response', () => {
    const validResponse = {
      tags: [
        { tag: 'beach', category: 'place', confidence: 0.95 },
        { tag: 'family', category: 'person', confidence: 0.88 },
        { tag: 'sunset', category: 'object', confidence: 0.72 },
      ],
      mood: {
        value: 'relaxing',
        confidence: 0.85,
      },
    };

    const result = photoAnalysisSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toHaveLength(3);
      expect(result.data.mood.value).toBe('relaxing');
    }
  });

  it('should reject invalid category', () => {
    const invalidResponse = {
      tags: [
        { tag: 'beach', category: 'invalid_category', confidence: 0.95 },
      ],
      mood: {
        value: 'relaxing',
        confidence: 0.85,
      },
    };

    const result = photoAnalysisSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });

  it('should reject invalid mood value', () => {
    const invalidResponse = {
      tags: [],
      mood: {
        value: 'invalid_mood',
        confidence: 0.85,
      },
    };

    const result = photoAnalysisSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });

  it('should reject confidence scores outside 0-1 range', () => {
    const invalidResponse = {
      tags: [
        { tag: 'beach', category: 'place', confidence: 1.5 },
      ],
      mood: {
        value: 'relaxing',
        confidence: 0.85,
      },
    };

    const result = photoAnalysisSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });

  it('should accept empty tags array', () => {
    const validResponse = {
      tags: [],
      mood: {
        value: 'neutral',
        confidence: 0.6,
      },
    };

    const result = photoAnalysisSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it('should validate all valid mood types', () => {
    const moods = ['calmer', 'darker', 'vibrant', 'relaxing', 'energetic', 'neutral'] as const;
    
    for (const mood of moods) {
      const response = {
        tags: [],
        mood: {
          value: mood,
          confidence: 0.8,
        },
      };
      const result = photoAnalysisSchema.safeParse(response);
      expect(result.success).toBe(true);
    }
  });

  it('should validate all valid tag categories', () => {
    const categories = ['person', 'place', 'object', 'event'] as const;
    
    for (const category of categories) {
      const response = {
        tags: [
          { tag: 'test', category, confidence: 0.7 },
        ],
        mood: {
          value: 'neutral',
          confidence: 0.5,
        },
      };
      const result = photoAnalysisSchema.safeParse(response);
      expect(result.success).toBe(true);
    }
  });
});

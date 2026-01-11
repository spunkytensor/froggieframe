import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Mood, PhotoTag } from '@/types';

const MAX_TAG_LENGTH = 100;
const MAX_TAG_COUNT = 20;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tagsParam = searchParams.get('tags');
    const mood = searchParams.get('mood') as Mood | null;
    const streamId = searchParams.get('stream_id');

    let query = supabase
      .from('photos')
      .select('*')
      .eq('user_id', user.id);

    if (streamId) {
      query = query.eq('stream_id', streamId);
    }

    if (mood) {
      query = query.eq('mood', mood);
    }

    const { data: photos, error: photosError } = await query.order('created_at', { ascending: false });

    if (photosError) {
      return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 });
    }

    let filteredPhotos = photos || [];

    const photoIds = filteredPhotos.map(p => p.id);
    const { data: allTags } = await supabase
      .from('photo_tags')
      .select('*')
      .in('photo_id', photoIds);

    const tagsByPhoto: Record<string, PhotoTag[]> = {};
    (allTags || []).forEach((tag) => {
      if (!tagsByPhoto[tag.photo_id]) tagsByPhoto[tag.photo_id] = [];
      tagsByPhoto[tag.photo_id].push(tag as PhotoTag);
    });

    if (tagsParam) {
      if (tagsParam.length > MAX_TAG_LENGTH * MAX_TAG_COUNT) {
        return NextResponse.json(
          { error: 'Tags parameter too long' },
          { status: 400 }
        );
      }

      const searchTags = tagsParam
        .toLowerCase()
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0 && t.length <= MAX_TAG_LENGTH)
        .slice(0, MAX_TAG_COUNT);

      if (searchTags.length === 0) {
        return NextResponse.json(
          { error: 'No valid tags provided' },
          { status: 400 }
        );
      }
      
      filteredPhotos = filteredPhotos.filter(photo => {
        const photoTags = (tagsByPhoto[photo.id] || []).map(t => t.tag.toLowerCase());
        return searchTags.some(searchTag => 
          photoTags.some(pt => pt.includes(searchTag))
        );
      });
    }

    const result = filteredPhotos.map(photo => ({
      ...photo,
      tags: tagsByPhoto[photo.id] || [],
    }));

    return NextResponse.json({ photos: result, count: result.length });
  } catch (error) {
    console.error('Search photos error:', error);
    return NextResponse.json(
      { error: 'Failed to search photos' },
      { status: 500 }
    );
  }
}

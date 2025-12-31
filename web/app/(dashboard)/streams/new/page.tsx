'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { streamSchema } from '@/lib/validators';

export default function NewStreamPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [interval, setInterval] = React.useState(30);
  const [shuffle, setShuffle] = React.useState(true);
  const [transition, setTransition] = React.useState<'fade' | 'cut'>('fade');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const validation = streamSchema.safeParse({
        name,
        description: description || undefined,
        slideshow_interval: interval,
        shuffle,
        transition_effect: transition,
      });

      if (!validation.success) {
        setError(validation.error.errors[0].message);
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data, error: dbError } = await supabase
        .from('photo_streams')
        .insert({
          user_id: user!.id,
          name,
          description: description || null,
          slideshow_interval: interval,
          shuffle,
          transition_effect: transition,
        })
        .select()
        .single();

      if (dbError) {
        setError(dbError.message);
        setLoading(false);
        return;
      }

      router.push(`/streams/${data.id}`);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create Photo Stream</CardTitle>
          <CardDescription>
            Set up a new photo collection for your frames
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Family Photos"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Photos from our family vacations"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interval">Slideshow Interval (seconds)</Label>
              <Input
                id="interval"
                type="number"
                min={5}
                max={3600}
                value={interval}
                onChange={(e) => setInterval(parseInt(e.target.value) || 30)}
              />
              <p className="text-xs text-muted-foreground">
                How long each photo displays (5-3600 seconds)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transition">Transition Effect</Label>
              <select
                id="transition"
                value={transition}
                onChange={(e) => setTransition(e.target.value as 'fade' | 'cut')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="fade">Fade</option>
                <option value="cut">Cut</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="shuffle"
                type="checkbox"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="shuffle">Shuffle photos</Label>
            </div>

            <div className="flex gap-4">
              <Button type="submit" isLoading={loading}>
                Create Stream
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}

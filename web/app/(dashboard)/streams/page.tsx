'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Plus, Image, MoreVertical, Trash2, Edit } from 'lucide-react';
import type { PhotoStream } from '@/types';

export default function StreamsPage() {
  const { user } = useAuth();
  const [streams, setStreams] = React.useState<PhotoStream[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState<string | null>(null);

  const fetchStreams = React.useCallback(async () => {
    if (!user) return;

    const supabase = createClient();
    const { data } = await supabase
      .from('photo_streams')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setStreams(data || []);
    setLoading(false);
  }, [user]);

  React.useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  const handleDelete = async (streamId: string) => {
    if (!confirm('Are you sure you want to delete this stream? All photos will be permanently deleted.')) {
      return;
    }

    const supabase = createClient();
    await supabase.from('photo_streams').delete().eq('id', streamId);
    setStreams(streams.filter(s => s.id !== streamId));
    setMenuOpen(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Photo Streams</h1>
          <p className="text-muted-foreground">
            Manage your photo collections
          </p>
        </div>
        <Link href="/streams/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Stream
          </Button>
        </Link>
      </div>

      {streams.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No streams yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first photo stream to get started
              </p>
              <Link href="/streams/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Stream
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {streams.map((stream) => (
            <Card key={stream.id} className="relative group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Link href={`/streams/${stream.id}`} className="flex-1">
                    <CardTitle className="hover:text-primary transition-colors">
                      {stream.name}
                    </CardTitle>
                  </Link>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === stream.id ? null : stream.id)}
                      className="p-1 rounded hover:bg-accent"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                    {menuOpen === stream.id && (
                      <div className="absolute right-0 mt-1 w-48 bg-card border rounded-md shadow-lg z-10">
                        <Link
                          href={`/streams/${stream.id}`}
                          className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
                          onClick={() => setMenuOpen(null)}
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(stream.id)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-accent w-full"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <CardDescription>
                  {stream.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <p>Interval: {stream.slideshow_interval}s</p>
                  <p>Shuffle: {stream.shuffle ? 'Yes' : 'No'}</p>
                  <p>Created: {new Date(stream.created_at).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

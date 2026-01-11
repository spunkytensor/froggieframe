'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Plus, Monitor, MoreVertical, Trash2, Edit, Wifi, WifiOff } from 'lucide-react';
import type { Frame } from '@/types';

export default function FramesPage() {
  const { user } = useAuth();
  const [frames, setFrames] = React.useState<Frame[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState<string | null>(null);

  const fetchFrames = React.useCallback(async () => {
    if (!user) return;

    const supabase = createClient();
    const { data } = await supabase
      .from('frames')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setFrames((data || []) as Frame[]);
    setLoading(false);
  }, [user]);

  React.useEffect(() => {
    fetchFrames();
  }, [fetchFrames]);

  const handleDelete = async (frameId: string) => {
    if (!confirm('Are you sure you want to delete this frame? All settings will be permanently deleted.')) {
      return;
    }

    const supabase = createClient();
    await supabase.from('frames').delete().eq('id', frameId);
    setFrames(frames.filter(f => f.id !== frameId));
    setMenuOpen(null);
  };

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return 'Never';
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 5) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
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
          <h1 className="text-3xl font-bold">Frames</h1>
          <p className="text-muted-foreground">
            Manage your photo frames
          </p>
        </div>
        <Link href="/frames/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Frame
          </Button>
        </Link>
      </div>

      {frames.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Monitor className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No frames yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first frame to get started
              </p>
              <Link href="/frames/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Frame
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {frames.map((frame) => (
            <Card key={frame.id} className="relative group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Link href={`/frames/${frame.id}`} className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="hover:text-primary transition-colors">
                        {frame.name}
                      </CardTitle>
                      {frame.is_online ? (
                        <Wifi className="h-4 w-4 text-green-500" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </Link>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === frame.id ? null : frame.id)}
                      className="p-1 rounded hover:bg-accent"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                    {menuOpen === frame.id && (
                      <div className="absolute right-0 mt-1 w-48 bg-card border rounded-md shadow-lg z-10">
                        <Link
                          href={`/frames/${frame.id}`}
                          className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
                          onClick={() => setMenuOpen(null)}
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(frame.id)}
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
                  {frame.location || 'No location set'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Interval: {frame.slideshow_interval}s</p>
                  <p>Orientation: {frame.orientation}</p>
                  <p>Last seen: {formatLastSeen(frame.last_seen_at)}</p>
                  <p>Created: {new Date(frame.created_at).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

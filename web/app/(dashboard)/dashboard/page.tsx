'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Image, Upload, Plus } from 'lucide-react';
import type { PhotoStream, Photo } from '@/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [streams, setStreams] = React.useState<PhotoStream[]>([]);
  const [photoCount, setPhotoCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      const supabase = createClient();

      // Fetch streams
      const { data: streamsData } = await supabase
        .from('photo_streams')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch photo count
      const { count } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setStreams(streamsData || []);
      setPhotoCount(count || 0);
      setLoading(false);
    };

    fetchData();
  }, [user]);

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
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Manage your photo streams.
          </p>
        </div>
        <Link href="/streams/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Stream
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Streams</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{streams.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Photos</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{photoCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Streams */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Streams</CardTitle>
          <CardDescription>
            Your most recently created photo streams
          </CardDescription>
        </CardHeader>
        <CardContent>
          {streams.length === 0 ? (
            <div className="text-center py-8">
              <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No photo streams yet. Create your first one!
              </p>
              <Link href="/streams/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Stream
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {streams.slice(0, 5).map((stream) => (
                <Link
                  key={stream.id}
                  href={`/streams/${stream.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors">
                    <div>
                      <h3 className="font-medium">{stream.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {stream.description || 'No description'}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(stream.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}

              {streams.length > 5 && (
                <Link href="/streams" className="block text-center">
                  <Button variant="link">View all streams</Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

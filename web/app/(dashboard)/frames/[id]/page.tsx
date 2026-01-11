'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import {
  Monitor,
  MapPin,
  Settings2,
  Image,
  ListMusic,
  Filter,
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import type { Frame, FrameSourceWithStream, FramePlaylist, FrameDisplayRules, PhotoStream } from '@/types';

export default function FrameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const frameId = params.id as string;

  const [frame, setFrame] = React.useState<Frame | null>(null);
  const [sources, setSources] = React.useState<FrameSourceWithStream[]>([]);
  const [playlists, setPlaylists] = React.useState<FramePlaylist[]>([]);
  const [displayRules, setDisplayRules] = React.useState<FrameDisplayRules | null>(null);
  const [availableStreams, setAvailableStreams] = React.useState<PhotoStream[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [newToken, setNewToken] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const [editName, setEditName] = React.useState('');
  const [editLocation, setEditLocation] = React.useState('');
  const [editTimezone, setEditTimezone] = React.useState('');
  const [editBrightness, setEditBrightness] = React.useState(100);
  const [editOrientation, setEditOrientation] = React.useState<'landscape' | 'portrait' | 'auto'>('landscape');
  const [editTransition, setEditTransition] = React.useState('fade');
  const [editInterval, setEditInterval] = React.useState(30);
  const [editShuffle, setEditShuffle] = React.useState(true);
  const [editWakeTime, setEditWakeTime] = React.useState('');
  const [editSleepTime, setEditSleepTime] = React.useState('');

  // Display rules local state
  const [editExcludeScreenshots, setEditExcludeScreenshots] = React.useState(true);
  const [editExcludeDuplicates, setEditExcludeDuplicates] = React.useState(true);
  const [editPreferOrientation, setEditPreferOrientation] = React.useState(true);
  const [editAspectRatio, setEditAspectRatio] = React.useState<'crop' | 'letterbox' | 'skip'>('letterbox');
  const [editFreshnessWeight, setEditFreshnessWeight] = React.useState(50);
  const [savingRules, setSavingRules] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/frames/${frameId}`);
      if (!response.ok) {
        router.push('/frames');
        return;
      }

      const data = await response.json();
      const f = data.frame;
      
      setFrame(f);
      setSources(f.sources || []);
      setPlaylists(f.playlists || []);
      setDisplayRules(f.display_rules || null);

      setEditName(f.name);
      setEditLocation(f.location || '');
      setEditTimezone(f.timezone);
      setEditBrightness(f.brightness);
      setEditOrientation(f.orientation);
      setEditTransition(f.transition_effect);
      setEditInterval(f.slideshow_interval);
      setEditShuffle(f.shuffle);
      setEditWakeTime(f.wake_time || '');
      setEditSleepTime(f.sleep_time || '');

      // Set display rules state
      const rules = f.display_rules;
      if (rules) {
        setEditExcludeScreenshots(rules.exclude_screenshots ?? true);
        setEditExcludeDuplicates(rules.exclude_duplicates ?? true);
        setEditPreferOrientation(rules.prefer_matching_orientation ?? true);
        setEditAspectRatio(rules.aspect_ratio_handling ?? 'letterbox');
        setEditFreshnessWeight(rules.freshness_weight ?? 50);
      }

      const supabase = createClient();
      const { data: streams } = await supabase
        .from('photo_streams')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      setAvailableStreams((streams || []) as PhotoStream[]);
    } catch {
      setError('Failed to load frame');
    } finally {
      setLoading(false);
    }
  }, [user, frameId, router]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/frames/${frameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          location: editLocation || null,
          timezone: editTimezone,
          brightness: editBrightness,
          orientation: editOrientation,
          transition_effect: editTransition,
          slideshow_interval: editInterval,
          shuffle: editShuffle,
          wake_time: editWakeTime || null,
          sleep_time: editSleepTime || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to save settings');
        return;
      }

      setSuccess('Settings saved successfully');
      await fetchData();
    } catch {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSource = async (streamId: string) => {
    try {
      const response = await fetch(`/api/frames/${frameId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: 'stream', stream_id: streamId }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to add source');
        return;
      }

      await fetchData();
      setSuccess('Source added');
    } catch {
      setError('Failed to add source');
    }
  };

  const handleRemoveSource = async (sourceId: string) => {
    try {
      const response = await fetch(`/api/frames/${frameId}/sources?source_id=${sourceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        setError('Failed to remove source');
        return;
      }

      setSources(sources.filter(s => s.id !== sourceId));
      setSuccess('Source removed');
    } catch {
      setError('Failed to remove source');
    }
  };

  const handleSaveDisplayRules = async () => {
    setSavingRules(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/frames/${frameId}/display-rules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exclude_screenshots: editExcludeScreenshots,
          exclude_duplicates: editExcludeDuplicates,
          prefer_matching_orientation: editPreferOrientation,
          aspect_ratio_handling: editAspectRatio,
          freshness_weight: editFreshnessWeight,
        }),
      });

      if (!response.ok) {
        setError('Failed to save display rules');
        return;
      }

      const data = await response.json();
      setDisplayRules(data.rules);
      setSuccess('Display rules saved');
    } catch {
      setError('Failed to save display rules');
    } finally {
      setSavingRules(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!confirm('Regenerate device token? The current token will stop working immediately.')) {
      return;
    }

    try {
      const response = await fetch(`/api/frames/${frameId}/token`, {
        method: 'POST',
      });

      if (!response.ok) {
        setError('Failed to regenerate token');
        return;
      }

      const data = await response.json();
      setNewToken(data.device_token);
    } catch {
      setError('Failed to regenerate token');
    }
  };

  const copyToken = () => {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const addedStreamIds = new Set(sources.filter(s => s.stream_id).map(s => s.stream_id));
  const unaddedStreams = availableStreams.filter(s => !addedStreamIds.has(s.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!frame) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Frame not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{frame.name}</h1>
            {frame.is_online ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <p className="text-muted-foreground">
            {frame.location || 'No location set'}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {newToken && (
        <Alert variant="warning">
          <AlertDescription>
            <p className="font-medium mb-2">New Device Token (save now!):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted p-2 rounded text-sm break-all">
                {newToken}
              </code>
              <Button size="icon" variant="outline" onClick={copyToken}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <CollapsibleCard
        title="Frame Identity"
        description="Basic information about this frame"
        icon={<Monitor className="h-5 w-5" />}
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Living Room"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="Main floor"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              value={editTimezone}
              onChange={(e) => setEditTimezone(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Intl.supportedValuesOf('timeZone').map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <Button onClick={handleSaveSettings} isLoading={saving}>
            Save Changes
          </Button>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Display Settings"
        description="How photos are displayed on this frame"
        icon={<Settings2 className="h-5 w-5" />}
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brightness">Brightness (%)</Label>
              <Input
                id="brightness"
                type="number"
                min={0}
                max={100}
                value={editBrightness}
                onChange={(e) => setEditBrightness(parseInt(e.target.value) || 100)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orientation">Orientation</Label>
              <select
                id="orientation"
                value={editOrientation}
                onChange={(e) => setEditOrientation(e.target.value as 'landscape' | 'portrait' | 'auto')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transition">Transition Effect</Label>
              <select
                id="transition"
                value={editTransition}
                onChange={(e) => setEditTransition(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="fade">Fade</option>
                <option value="cut">Cut</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="interval">Slideshow Interval (seconds)</Label>
              <Input
                id="interval"
                type="number"
                min={5}
                max={3600}
                value={editInterval}
                onChange={(e) => setEditInterval(parseInt(e.target.value) || 30)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="shuffle"
              type="checkbox"
              checked={editShuffle}
              onChange={(e) => setEditShuffle(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="shuffle">Shuffle photos</Label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wakeTime">Wake Time</Label>
              <Input
                id="wakeTime"
                type="time"
                value={editWakeTime}
                onChange={(e) => setEditWakeTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sleepTime">Sleep Time</Label>
              <Input
                id="sleepTime"
                type="time"
                value={editSleepTime}
                onChange={(e) => setEditSleepTime(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleSaveSettings} isLoading={saving}>
            Save Changes
          </Button>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Content Sources"
        description="Which photo streams to display on this frame"
        icon={<Image className="h-5 w-5" />}
      >
        <div className="space-y-4">
          {sources.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No sources added yet. Add a stream to display photos on this frame.
            </p>
          ) : (
            <div className="space-y-2">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{source.stream?.name || 'Unknown Stream'}</p>
                    <p className="text-sm text-muted-foreground">
                      Weight: {source.weight}% | Sync: {source.sync_frequency}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveSource(source.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {unaddedStreams.length > 0 && (
            <div className="space-y-2">
              <Label>Add Stream</Label>
              <div className="flex gap-2">
                <select
                  id="add-stream"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddSource(e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">Select a stream...</option>
                  {unaddedStreams.map((stream) => (
                    <option key={stream.id} value={stream.id}>
                      {stream.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {availableStreams.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No streams available. <a href="/streams/new" className="text-primary hover:underline">Create a stream</a> first.
            </p>
          )}
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Display Rules"
        description="Content filtering and display preferences"
        icon={<Filter className="h-5 w-5" />}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              id="excludeScreenshots"
              type="checkbox"
              checked={editExcludeScreenshots}
              onChange={(e) => setEditExcludeScreenshots(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="excludeScreenshots">Exclude screenshots</Label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="excludeDuplicates"
              type="checkbox"
              checked={editExcludeDuplicates}
              onChange={(e) => setEditExcludeDuplicates(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="excludeDuplicates">Exclude duplicates</Label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="preferOrientation"
              type="checkbox"
              checked={editPreferOrientation}
              onChange={(e) => setEditPreferOrientation(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="preferOrientation">Prefer matching orientation</Label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="aspectRatio">Aspect Ratio Handling</Label>
              <select
                id="aspectRatio"
                value={editAspectRatio}
                onChange={(e) => setEditAspectRatio(e.target.value as 'crop' | 'letterbox' | 'skip')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="letterbox">Letterbox</option>
                <option value="crop">Crop to fill</option>
                <option value="skip">Skip mismatched</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="freshness">Freshness Weight (0-100)</Label>
              <Input
                id="freshness"
                type="number"
                min={0}
                max={100}
                value={editFreshnessWeight}
                onChange={(e) => setEditFreshnessWeight(parseInt(e.target.value) || 50)}
              />
              <p className="text-xs text-muted-foreground">
                Higher = prefer newer photos
              </p>
            </div>
          </div>
          <Button onClick={handleSaveDisplayRules} isLoading={savingRules}>
            Save Changes
          </Button>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Device Token"
        description="Authentication token for this frame"
        icon={<Key className="h-5 w-5" />}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The device token is used to authenticate your Raspberry Pi frame. 
            If you lose it, you&apos;ll need to regenerate and reconfigure your device.
          </p>
          <Button variant="outline" onClick={handleRegenerateToken}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate Token
          </Button>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Configure your frame:</p>
            <code className="text-xs block bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap">
              python3 froggie-frame.py --api-url {typeof window !== 'undefined' ? window.location.origin : 'https://your-app.vercel.app'} --device-token YOUR_DEVICE_TOKEN
            </code>
          </div>
        </div>
      </CollapsibleCard>
    </div>
  );
}

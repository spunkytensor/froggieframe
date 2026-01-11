'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check } from 'lucide-react';

export default function NewFramePage() {
  const router = useRouter();

  const [name, setName] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [timezone, setTimezone] = React.useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [deviceToken, setDeviceToken] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [createdFrameId, setCreatedFrameId] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          location: location || null,
          timezone,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to create frame');
        setLoading(false);
        return;
      }

      const data = await response.json();
      setDeviceToken(data.device_token);
      setCreatedFrameId(data.frame.id);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    if (deviceToken) {
      navigator.clipboard.writeText(deviceToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (deviceToken && createdFrameId) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Frame Created Successfully</CardTitle>
            <CardDescription>
              Save your device token now - it won&apos;t be shown again!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="warning">
              <AlertDescription>
                <p className="font-medium mb-2">Device Token (save this now!):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted p-2 rounded text-sm break-all">
                    {deviceToken}
                  </code>
                  <Button size="icon" variant="outline" onClick={copyToken}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Configure your Raspberry Pi frame:</p>
              <code className="text-xs block bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap">
                python3 froggie-frame.py --api-url {typeof window !== 'undefined' ? window.location.origin : 'https://your-app.vercel.app'} --device-token YOUR_DEVICE_TOKEN
              </code>
            </div>

            <div className="flex gap-4">
              <Button onClick={() => router.push(`/frames/${createdFrameId}`)}>
                Configure Frame
              </Button>
              <Button variant="outline" onClick={() => router.push('/frames')}>
                View All Frames
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create New Frame</CardTitle>
          <CardDescription>
            Set up a new photo frame device
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
              <Label htmlFor="name">Frame Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Living Room"
                required
              />
              <p className="text-xs text-muted-foreground">
                A friendly name to identify this frame
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location (optional)</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Main Floor, near the fireplace"
              />
              <p className="text-xs text-muted-foreground">
                Physical location of the frame
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {Intl.supportedValuesOf('timeZone').map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <Button type="submit" isLoading={loading}>
                Create Frame
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

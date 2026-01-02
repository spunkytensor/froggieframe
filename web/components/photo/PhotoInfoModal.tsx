'use client';

import * as React from 'react';
import { X, MapPin, Calendar, RotateCw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Photo } from '@/types';

interface PhotoInfoModalProps {
  photo: Photo;
  onClose: () => void;
}

const ORIENTATION_LABELS: Record<number, string> = {
  1: 'Normal',
  2: 'Flipped horizontally',
  3: 'Rotated 180°',
  4: 'Flipped vertically',
  5: 'Rotated 90° CCW, flipped',
  6: 'Rotated 90° CW',
  7: 'Rotated 90° CW, flipped',
  8: 'Rotated 90° CCW',
};

function formatDateTime(isoString: string | null): string {
  if (!isoString) return 'Unknown';
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function PhotoInfoModal({ photo, onClose }: PhotoInfoModalProps) {
  const hasLocation = photo.exif_latitude !== null && photo.exif_longitude !== null;

  const mapLinkUrl = hasLocation
    ? `https://www.openstreetmap.org/?mlat=${photo.exif_latitude}&mlon=${photo.exif_longitude}#map=15/${photo.exif_latitude}/${photo.exif_longitude}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60" 
        onClick={onClose}
      />
      <div className="relative bg-background rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Photo Info</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Filename</p>
              <p className="text-sm text-muted-foreground break-all">{photo.filename}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Date Taken</p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(photo.exif_captured_at)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <RotateCw className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Orientation</p>
              <p className="text-sm text-muted-foreground">
                {photo.exif_orientation 
                  ? ORIENTATION_LABELS[photo.exif_orientation] || `Value: ${photo.exif_orientation}`
                  : 'Unknown'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Location</p>
              {hasLocation ? (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    {photo.exif_latitude!.toFixed(6)}, {photo.exif_longitude!.toFixed(6)}
                  </p>
                  <a 
                    href={mapLinkUrl!} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full h-12 rounded-lg border bg-muted hover:bg-muted/80 transition-colors text-sm font-medium"
                  >
                    <MapPin className="h-4 w-4" />
                    View on OpenStreetMap
                  </a>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No location data</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

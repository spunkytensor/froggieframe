import sharp from 'sharp';

export interface ExifMetadata {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  capturedAt: Date | null;
  orientation: number | null;
}

function convertDMSToDecimal(
  dms: number[] | undefined,
  ref: string | undefined
): number | null {
  if (!dms || dms.length !== 3) return null;
  
  const [degrees, minutes, seconds] = dms;
  let decimal = degrees + minutes / 60 + seconds / 3600;
  
  if (ref === 'S' || ref === 'W') {
    decimal = -decimal;
  }
  
  return decimal;
}

function parseXmpDate(xmpBuffer: Buffer): Date | null {
  try {
    const xmpString = xmpBuffer.toString('utf8');
    
    // Look for common date patterns in XMP
    const patterns = [
      /DateTimeOriginal[^>]*>([^<]+)</i,
      /CreateDate[^>]*>([^<]+)</i,
      /DateCreated[^>]*>([^<]+)</i,
      /xmp:CreateDate="([^"]+)"/i,
      /photoshop:DateCreated="([^"]+)"/i,
    ];
    
    for (const pattern of patterns) {
      const match = xmpString.match(pattern);
      if (match?.[1]) {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
  } catch {
    // XMP parsing failed
  }
  return null;
}

function parseXmpGps(xmpBuffer: Buffer): { lat: number; lon: number } | null {
  try {
    const xmpString = xmpBuffer.toString('utf8');
    
    // Look for GPS coordinates in XMP (format: "47,30.123N" or decimal)
    const latMatch = xmpString.match(/GPSLatitude[^>]*>([^<]+)</i) || 
                     xmpString.match(/exif:GPSLatitude="([^"]+)"/i);
    const lonMatch = xmpString.match(/GPSLongitude[^>]*>([^<]+)</i) ||
                     xmpString.match(/exif:GPSLongitude="([^"]+)"/i);
    
    if (latMatch?.[1] && lonMatch?.[1]) {
      const lat = parseXmpCoordinate(latMatch[1]);
      const lon = parseXmpCoordinate(lonMatch[1]);
      if (lat !== null && lon !== null) {
        return { lat, lon };
      }
    }
  } catch {
    // XMP parsing failed
  }
  return null;
}

function parseXmpCoordinate(coord: string): number | null {
  // Format: "47,30.5N" or "47,30,30N" or just decimal
  const dmsMatch = coord.match(/^(\d+),(\d+(?:\.\d+)?),?(\d+(?:\.\d+)?)?([NSEW])$/i);
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]);
    const min = parseFloat(dmsMatch[2]);
    const sec = parseFloat(dmsMatch[3] || '0');
    const ref = dmsMatch[4].toUpperCase();
    let decimal = deg + min / 60 + sec / 3600;
    if (ref === 'S' || ref === 'W') decimal = -decimal;
    return decimal;
  }
  
  // Try parsing as decimal
  const decimal = parseFloat(coord);
  if (!isNaN(decimal)) return decimal;
  
  return null;
}

export async function extractExifMetadata(imageBuffer: Buffer): Promise<ExifMetadata> {
  const result: ExifMetadata = {
    latitude: null,
    longitude: null,
    altitude: null,
    capturedAt: null,
    orientation: null,
  };

  try {
    const metadata = await sharp(imageBuffer).metadata();
    
    // Get orientation from sharp metadata (works for most formats)
    if (metadata.orientation && metadata.orientation >= 1 && metadata.orientation <= 8) {
      result.orientation = metadata.orientation;
    }

    // Try XMP first (HEIC often stores metadata here)
    if (metadata.xmp) {
      const xmpDate = parseXmpDate(metadata.xmp);
      if (xmpDate) {
        result.capturedAt = xmpDate;
      }
      
      const xmpGps = parseXmpGps(metadata.xmp);
      if (xmpGps) {
        result.latitude = xmpGps.lat;
        result.longitude = xmpGps.lon;
      }
    }

    // Then try EXIF buffer
    if (metadata.exif) {
      let exifData: ExifReaderResult | null = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const exifReader = require('exif-reader');
        exifData = exifReader(metadata.exif);
      } catch {
        // exif-reader failed to parse EXIF buffer
      }
      
      if (exifData) {
        // GPS coordinates (exif-reader v2 uses GPSInfo)
        const gps = exifData.GPSInfo || exifData.gps;
        if (gps && !result.latitude) {
          result.latitude = convertDMSToDecimal(gps.GPSLatitude, gps.GPSLatitudeRef);
          result.longitude = convertDMSToDecimal(gps.GPSLongitude, gps.GPSLongitudeRef);
          
          if (gps.GPSAltitude !== undefined) {
            result.altitude = gps.GPSAltitude;
            if (gps.GPSAltitudeRef === 1) {
              result.altitude = -result.altitude;
            }
          }
        }
        
        // Capture date
        const photo = exifData.Photo || exifData.exif;
        const image = exifData.Image || exifData.image;
        
        if (!result.capturedAt) {
          if (photo?.DateTimeOriginal instanceof Date) {
            result.capturedAt = photo.DateTimeOriginal;
          } else if (image?.DateTime instanceof Date) {
            result.capturedAt = image.DateTime;
          }
        }
        
        // Orientation from EXIF if not already set
        if (!result.orientation && image?.Orientation) {
          const orient = image.Orientation;
          if (orient >= 1 && orient <= 8) {
            result.orientation = orient;
          }
        }
      }
    }
    
  } catch {
    // EXIF extraction failed
  }

  return result;
}

interface ExifReaderResult {
  Image?: {
    DateTime?: Date | string;
    Orientation?: number;
  };
  Photo?: {
    DateTimeOriginal?: Date | string;
  };
  GPSInfo?: {
    GPSLatitude?: number[];
    GPSLatitudeRef?: string;
    GPSLongitude?: number[];
    GPSLongitudeRef?: string;
    GPSAltitude?: number;
    GPSAltitudeRef?: number;
  };
  image?: {
    DateTime?: string;
    Orientation?: number;
  };
  exif?: {
    DateTimeOriginal?: string;
  };
  gps?: {
    GPSLatitude?: number[];
    GPSLatitudeRef?: string;
    GPSLongitude?: number[];
    GPSLongitudeRef?: string;
    GPSAltitude?: number;
    GPSAltitudeRef?: number;
  };
}

export async function extractExifFromUrl(imageUrl: string): Promise<ExifMetadata> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return extractExifMetadata(buffer);
}

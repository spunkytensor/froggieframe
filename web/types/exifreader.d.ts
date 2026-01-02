declare module 'exifreader' {
  interface TagValue<T = unknown> {
    value: T;
    description?: string;
  }

  interface ExifTags {
    Orientation?: TagValue<number>;
    DateTimeOriginal?: TagValue<string>;
    DateTime?: TagValue<string>;
    GPSLatitude?: TagValue<number[]>;
    GPSLatitudeRef?: TagValue<string[]>;
    GPSLongitude?: TagValue<number[]>;
    GPSLongitudeRef?: TagValue<string[]>;
    GPSAltitude?: TagValue<number>;
    [key: string]: TagValue | undefined;
  }

  interface GpsTags {
    Latitude?: number;
    Longitude?: number;
    Altitude?: number;
  }

  interface ExpandedTags {
    exif?: ExifTags;
    gps?: GpsTags;
    iptc?: Record<string, TagValue>;
    xmp?: Record<string, TagValue>;
  }

  interface LoadOptions {
    expanded?: boolean;
  }

  export function load(data: ArrayBuffer, options?: LoadOptions): ExpandedTags;
}

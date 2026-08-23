import type { ShapefileRelatedToolLink } from '../types/shapefile-viewer.types';

export const SHAPEFILE_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.zip',
  '.shp',
  '.dbf',
  '.shx',
  '.prj',
  '.cpg'
];

export const SHAPEFILE_PART_EXTENSIONS: ReadonlyArray<string> = [
  '.shp',
  '.dbf',
  '.shx',
  '.prj',
  '.cpg'
];

export const SHAPEFILE_ACCEPT_ATTR =
  '.zip,.shp,.dbf,.shx,.prj,.cpg,application/zip,application/x-zip-compressed';

export const SHAPEFILE_FORMATS_LABEL = '.zip or .shp + .dbf + .shx';

export const SHAPEFILE_FORMATS_HINT =
  'ESRI Shapefile archive (.zip) or multi-select .shp with sidecars (.dbf, .shx, optional .prj / .cpg)';

export const SHAPEFILE_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const SHAPEFILE_LARGE_FEATURE_WARNING = 2000;

export const SHAPEFILE_ATTR_TABLE_MAX_COLUMNS = 8;

export const SHAPEFILE_ATTR_TABLE_MAX_ROWS = 200;

export const SHAPEFILE_RELATED_TOOLS: ReadonlyArray<ShapefileRelatedToolLink> = [
  {
    label: 'GeoJSON Viewer',
    description: 'Interactive map for FeatureCollections',
    path: '/gis-viewers/geojson-viewer'
  },
  {
    label: 'GPX Viewer',
    description: 'GPS tracks with elevation and stats',
    path: '/gis-viewers/gpx-viewer'
  },
  {
    label: 'KML Viewer',
    description: 'Google Earth placemarks and paths',
    path: '/gis-viewers/kml-viewer'
  }
];

/**
 * Tiny Point shapefile zip (sample_city.shp/.shx/.dbf/.prj) for San Francisco landmarks.
 * Generated offline with JSZip + minimal binary writers; verified with shpjs.
 */
export const SHAPEFILE_SAMPLE_ZIP_BASE64 =
  'UEsDBAoAAAAIALEaBl0RUaW+agAAANQAAAAPAAAAc2FtcGxlX2NpdHkuc2hwY2BQ52LADrJeMDMwMAIZOldmPZOdH3cgfoaPaM8jJwfhxMOXtWfGHTj6b1P1pxdODjj0IwOQMVwgIuCPRPH1WXEHXj8ykzrwGKyXCSYHM/f575UfLz0FyzHD5AKzZ5XPmYdiJwtMDt19AFBLAwQKAAAACACxGgZdj3nii0MAAACEAAAADwAAAHNhbXBsZV9jaXR5LnNoeGNgUOdiwA6cXjAzMDACGTpXZj2TnR93IH6Gj2jPIycH4cTDl7Vnxh04+m9T9acXTg449CMDIyAG2eMApf2gdAyIBgBQSwMECgAAAAgAsRoGXSpqJlqlAAAAngEAAA8AAABzYW1wbGVfY2l0eS5kYmaVj7sKwkAQRRcUEcHOympKy8THB5iAsfIfht0xDO4DNg/YRvDP3YA2cRW8xXCHAwfu5D6fTYUQD1GJVCwaetVyOJsRl9hS7Xx489WI99xw63wT62X4FyO+hJLbAGfUGn5Hcs8ySfJtlsGJvA9QdKwV2/q7RqNVBv3tk+wPUVM5rchCFWdB4VnV9Kcmz2KgRM1X5y0jHCUqMiGtMV1DnUmRXRy1fgJQSwMECgAAAAgAsRoGXVV/Q695AAAAkQAAAA8AAABzYW1wbGVfY2l0eS5wcmpzd/V3dw6OVgIS8eHuwfGGlhYmSjoujiGhvtFKLkhCwQEerkH+ni7RSggxM2NzC0Njcz0DHSNLCz0jU3MjI2NTM+PYWJ2AIE9fV6AJ7kWpqXnlmckZSjoGegaxOqF+niFAc1PTgeJgIUNzE1NjI0sjU0NLSxNjoFYAUEsBAhQACgAAAAgAsRoGXRFRpb5qAAAA1AAAAA8AAAAAAAAAAAAAAAAAAAAAAHNhbXBsZV9jaXR5LnNocFBLAQIUAAoAAAAIALEaBl2PeeKLQwAAAIQAAAAPAAAAAAAAAAAAAAAAAJcAAABzYW1wbGVfY2l0eS5zaHhQSwECFAAKAAAACACxGgZdKmomWqUAAACeAQAADwAAAAAAAAAAAAAAAAAHAQAAc2FtcGxlX2NpdHkuZGJmUEsBAhQACgAAAAgAsRoGXVV/Q695AAAAkQAAAA8AAAAAAAAAAAAAAAAA2QEAAHNhbXBsZV9jaXR5LnByalBLBQYAAAAABAAEAPQAAAB/AgAAAAA=';

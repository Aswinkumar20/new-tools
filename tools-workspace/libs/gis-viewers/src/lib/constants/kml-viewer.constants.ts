import type { KmlRelatedToolLink } from '../types/kml-viewer.types';

export const KML_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.kml', '.xml'];

export const KML_ACCEPT_ATTR =
  '.kml,.xml,application/vnd.google-earth.kml+xml,application/xml,text/xml';

export const KML_FORMATS_LABEL = '.kml, .xml';

export const KML_FORMATS_HINT =
  'KML 2.2 Placemarks, paths, and polygons from Google Earth, Maps, or GIS exports';

export const KML_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const KML_RELATED_TOOLS: ReadonlyArray<KmlRelatedToolLink> = [
  {
    label: 'KMZ Viewer',
    description: 'Zipped KML packages on a map',
    path: '/gis-viewers/kmz-viewer'
  },
  {
    label: 'GeoJSON Viewer',
    description: 'Interactive map for FeatureCollections',
    path: '/gis-viewers/geojson-viewer'
  },
  {
    label: 'TopoJSON Viewer',
    description: 'Topology-preserving map data',
    path: '/gis-viewers/topojson-viewer'
  }
];

/** Sample tour with folders, point / line / polygon placemarks. */
export const KML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Sample Bay Area Tour</name>
    <description>Demo placemarks for the KML viewer</description>
    <Style id="bridge-pin">
      <IconStyle>
        <color>ff0000ff</color>
        <scale>1.1</scale>
      </IconStyle>
    </Style>
    <Folder>
      <name>Landmarks</name>
      <Placemark>
        <name>Golden Gate Bridge</name>
        <description>Iconic suspension bridge at the Golden Gate</description>
        <styleUrl>#bridge-pin</styleUrl>
        <Point>
          <coordinates>-122.4783,37.8199,0</coordinates>
        </Point>
      </Placemark>
      <Placemark>
        <name>Ferry Building</name>
        <description>Marketplace and ferry terminal on the Embarcadero</description>
        <Point>
          <coordinates>-122.3933,37.7955,0</coordinates>
        </Point>
      </Placemark>
    </Folder>
    <Folder>
      <name>Routes</name>
      <Placemark>
        <name>Embarcadero Path</name>
        <description>Waterfront walk from the Ferry Building toward City Hall</description>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>
            -122.3933,37.7955,0
            -122.4050,37.7920,0
            -122.4194,37.7793,0
          </coordinates>
        </LineString>
      </Placemark>
    </Folder>
    <Folder>
      <name>Empty Folder</name>
    </Folder>
    <Placemark>
      <name>Golden Gate Park</name>
      <description>Large urban park west of downtown</description>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -122.5115,37.7711,0
              -122.4542,37.7711,0
              -122.4542,37.7749,0
              -122.5115,37.7749,0
              -122.5115,37.7711,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>
`;

import { Routes } from '@angular/router';

export const GIS_VIEWERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'geojson-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/geojson-viewer/geojson-viewer').then(m => m.GeoJsonViewerComponent),
  },
  {
    path: 'shapefile-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/shapefile-viewer/shapefile-viewer').then(m => m.ShapefileViewerComponent),
  },
  {
    path: 'kml-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/kml-viewer/kml-viewer').then(m => m.KmlViewerComponent),
  },
  {
    path: 'kmz-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/kmz-viewer/kmz-viewer').then(m => m.KmzViewerComponent),
  },
  {
    path: 'gpx-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/gpx-viewer/gpx-viewer').then(m => m.GpxViewerComponent),
  },
  {
    path: 'topojson-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/topojson-viewer/topojson-viewer').then(m => m.TopoJsonViewerComponent),
  },
  {
    path: 'geopackage-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/geopackage-viewer/geopackage-viewer').then(m => m.GeoPackageViewerComponent),
  },
  {
    path: 'mbtiles-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/mbtiles-viewer/mbtiles-viewer').then(m => m.MbtilesViewerComponent),
  },
  {
    path: 'geotiff-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/geotiff-viewer/geotiff-viewer').then(m => m.GeotiffViewerComponent),
  },
  {
    path: 'cog-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/cog-viewer/cog-viewer').then(m => m.CogViewerComponent),
  },
  {
    path: 'dem-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/dem-viewer/dem-viewer').then(m => m.DemViewerComponent),
  },
  {
    path: 'terrain-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/terrain-viewer/terrain-viewer').then(m => m.TerrainViewerComponent),
  },
  {
    path: 'contour-map-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/contour-map-viewer/contour-map-viewer').then(m => m.ContourMapViewerComponent),
  },
  {
    path: 'gps-track-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/gps-track-viewer/gps-track-viewer').then(m => m.GpsTrackViewerComponent),
  },
  {
    path: 'drone-flight-path-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/drone-flight-path-viewer/drone-flight-path-viewer').then(m => m.DroneFlightPathViewerComponent),
  },
  {
    path: 'lidar-map-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/lidar-map-viewer/lidar-map-viewer').then(m => m.LidarMapViewerComponent),
  },
  {
    path: 'point-cloud-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/point-cloud-viewer/point-cloud-viewer').then(m => m.PointCloudViewerComponent),
  },
  {
    path: 'satellite-image-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/satellite-image-viewer/satellite-image-viewer').then(m => m.SatelliteImageViewerComponent),
  },
  {
    path: 'vector-tile-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/vector-tile-viewer/vector-tile-viewer').then(m => m.VectorTileViewerComponent),
  },
  {
    path: 'raster-map-viewer',
    loadComponent: () =>
      import('@tools-workspace/gis-viewers/raster-map-viewer/raster-map-viewer').then(m => m.RasterMapViewerComponent),
  },
];

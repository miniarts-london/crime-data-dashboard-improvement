'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import '@/lib/crime-map.css';
import { colorFor, type ColorMode } from '@/lib/theme';
import { crimePopupHtml } from '@/lib/crimePopup';
import { useColorMode } from './ContextRoot/Providers';
import type { CrimeRecord, SearchPoint } from '@/types/dashboard';

const LIGHT_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const LIGHT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function crimeDivIcon(color: string) {
  return L.divIcon({
    className: 'crime-marker-icon',
    html: `<span class="crime-dot" style="background:${color}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => {
      map.invalidateSize();
    }, 0);
    return () => window.clearTimeout(id);
  }, [map]);
  return null;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.flyTo(points[0], 14);
      return;
    }
    map.flyToBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
  }, [points, map]);
  return null;
}

function ClusterLayer({ crimes, mode }: { crimes: CrimeRecord[]; mode: ColorMode }) {
  const map = useMap();

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: false,
      spiderfyDistanceMultiplier: 1.6,
    });

    cluster.on('clusterclick', (event: L.LeafletEvent) => {
      const clusterLayer = (event as L.MarkerClusterMouseEvent).layer;
      const markers = clusterLayer.getAllChildMarkers();
      const first = markers[0]?.getLatLng();
      const overlapping = Boolean(
        first && markers.every((marker) => marker.getLatLng().distanceTo(first) < 5)
      );
      if (overlapping || markers.length <= 12 || map.getZoom() >= 16) {
        const html = markers
          .map((marker) => marker.getPopup()?.getContent())
          .filter((content): content is string => typeof content === 'string' && content.length > 0)
          .join('<hr class="crime-popup-rule" />');
        L.popup({ maxWidth: 280, maxHeight: 240, autoPan: true })
          .setLatLng(clusterLayer.getLatLng())
          .setContent(`<div class="crime-popup-list">${html}</div>`)
          .openOn(map);
        return;
      }
      clusterLayer.zoomToBounds({ padding: [24, 24] });
    });

    crimes.forEach((crime) => {
      if (crime.lat == null || crime.lng == null) return;
      const marker = L.marker([crime.lat, crime.lng], {
        icon: crimeDivIcon(colorFor(crime.bucket, mode)),
        riseOnHover: true,
      });
      marker.bindPopup(crimePopupHtml(crime), { maxWidth: 260, autoPan: true });
      cluster.addLayer(marker);
    });

    map.addLayer(cluster);
    return () => {
      try {
        map.removeLayer(cluster);
      } catch {
        // Map already destroyed (Strict Mode / Fast Refresh).
      }
    };
  }, [map, crimes, mode]);

  return null;
}

interface CrimeMapProps {
  crimes: CrimeRecord[];
  searchPoints: SearchPoint[];
}

function CrimeMap({ crimes, searchPoints }: CrimeMapProps) {
  const { mode } = useColorMode();
  const [mapKey, setMapKey] = useState(0);
  const searchDivIcon = useMemo(
    () =>
      L.divIcon({
        className: 'search-marker-icon',
        html: '<span class="search-dot"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -10],
      }),
    []
  );
  const mappable = crimes.filter((c) => c.hasLocation && c.lat !== null && c.lng !== null);
  const boundsPoints: [number, number][] = [
    ...searchPoints.map((p): [number, number] => [p.lat, p.lng]),
    ...mappable.map((c): [number, number] => [c.lat as number, c.lng as number]),
  ];

  // Leaflet keeps a stale map instance across Fast Refresh / Strict Mode
  // remounts. Bump the key after mount so MapContainer always binds to a live DOM node.
  useEffect(() => {
    setMapKey((key) => key + 1);
  }, []);

  if (mapKey === 0) {
    return <div style={{ height: '100%', width: '100%' }} />;
  }

  return (
    <MapContainer
      key={mapKey}
      center={[51.5074, -0.1278]}
      zoom={12}
      maxZoom={18}
      style={{ height: '100%', width: '100%' }}
    >
      <InvalidateSize />
      <TileLayer
        attribution={mode === 'dark' ? DARK_ATTRIBUTION : LIGHT_ATTRIBUTION}
        url={mode === 'dark' ? DARK_TILE_URL : LIGHT_TILE_URL}
      />
      <FitBounds points={boundsPoints} />
      {searchPoints.map((p) => (
        <Marker
          key={p.postcode}
          position={[p.lat, p.lng]}
          icon={searchDivIcon}
          eventHandlers={{
            click: (event) => {
              event.target.openPopup();
            },
          }}
        >
          <Popup>Search: {p.postcode}</Popup>
        </Marker>
      ))}
      <ClusterLayer crimes={mappable} mode={mode} />
    </MapContainer>
  );
}

export default memo(CrimeMap);
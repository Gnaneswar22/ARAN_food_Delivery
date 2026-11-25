import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TILES = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const pin = (emoji, bg) => L.divIcon({ className: '', iconSize: [40, 40], iconAnchor: [20, 20], html: `<div style="width:40px;height:40px;border-radius:50%;background:${bg};display:grid;place-items:center;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,.3);border:3px solid #fff">${emoji}</div>` });

/** Live rider map: rider marker moves as new positions arrive; destination marker if the address has coordinates. */
export default function TrackMap({ rider, destination, className }) {
  const el = useRef(null);
  const map = useRef(null);
  const riderMarker = useRef(null);

  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([rider.lat, rider.lng], 15);
    L.tileLayer(TILES, { maxZoom: 19, attribution: import.meta.env.VITE_MAP_ATTRIBUTION || '© OpenStreetMap contributors' }).addTo(map.current);
    riderMarker.current = L.marker([rider.lat, rider.lng], { icon: pin('🛵', '#E87535'), title: 'Your rider' }).addTo(map.current);
    if (destination) L.marker([destination.lat, destination.lng], { icon: pin('🏠', '#477B53'), title: 'Delivery address' }).addTo(map.current);
    return () => { map.current.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map.current) return;
    riderMarker.current.setLatLng([rider.lat, rider.lng]);
    if (destination) map.current.fitBounds(L.latLngBounds([[rider.lat, rider.lng], [destination.lat, destination.lng]]), { padding: [50, 50], maxZoom: 16 });
    else map.current.panTo([rider.lat, rider.lng]);
  }, [rider.lat, rider.lng, destination?.lat, destination?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={className} role="img" aria-label="Live map showing your rider's position" />;
}

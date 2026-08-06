"use client";
import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';

// Component to handle clicks on map to move the marker
function MapEvents({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom());
    }
  }, [position, map]);

  return position ? <Marker position={position} /> : null;
}

export default function MapPickerInner({ location, onChange }) {
  const defaultCenter = [19.4326, -99.1332]; // Mexico City default
  const [position, setPosition] = useState(location || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (location && (!position || location[0] !== position[0] || location[1] !== position[1])) {
      setPosition(location);
    }
  }, [location]);

  const handlePositionChange = (pos) => {
    setPosition(pos);
    if (onChange) onChange(pos);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    setSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        handlePositionChange([lat, lon]);
      } else {
        alert("No se encontró la dirección.");
      }
    } catch (error) {
      console.error("Search error:", error);
      alert("Error al buscar dirección.");
    }
    setSearching(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', height: '100%' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input 
          type="text" 
          className="form-input" 
          placeholder="Buscar dirección en el mapa..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch(e);
            }
          }}
          style={{ flex: 1 }}
        />
        <button type="button" onClick={handleSearch} className="btn btn-secondary" disabled={searching}>
          {searching ? 'Buscando...' : 'Buscar'}
        </button>
      </div>
      
      <div style={{ flex: 1, minHeight: '300px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <MapContainer center={position || defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapEvents position={position} setPosition={handlePositionChange} />
        </MapContainer>
      </div>
      <p className="text-sm text-secondary">
        {position ? `Coordenadas: ${position[0].toFixed(6)}, ${position[1].toFixed(6)}` : 'Haz clic en el mapa para marcar la ubicación.'}
      </p>
    </div>
  );
}

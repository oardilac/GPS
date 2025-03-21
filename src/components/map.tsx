"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Corregir el problema de los íconos de Leaflet
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: icon.src,
  shadowUrl: iconShadow.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
  location: {
    lat: number;
    lng: number;
  };
}

export default function MapComponent({ location }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    // Inicializar el mapa si no existe
    if (!mapRef.current) {
      mapRef.current = L.map("map").setView([location.lat, location.lng], 15);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);

      // Crear el marcador inicial
      markerRef.current = L.marker([location.lat, location.lng]).addTo(
        mapRef.current
      );
    } else {
      // Actualizar la vista del mapa
      mapRef.current.setView([location.lat, location.lng], 15);

      // Actualizar la posición del marcador
      if (markerRef.current) {
        markerRef.current.setLatLng([location.lat, location.lng]);
      }
    }
  }, [location]);

  return <div id="map" className="h-full w-full" />;
}

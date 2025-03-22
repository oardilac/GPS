"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocationData } from "@/lib/types";
import { predictFutureRoute } from "@/lib/dynamodb";

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
  pathData?: LocationData[];
  showPaths?: boolean;
}

export default function MapComponent({
  location,
  pathData = [],
  showPaths = false,
}: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const pastPathRef = useRef<L.Polyline | null>(null);
  const futurePathRef = useRef<L.Polyline | null>(null);
  const [futurePathData, setFuturePathData] = useState<LocationData[]>([]);

  // Función para obtener predicción de ruta futura
  const getFuturePathPrediction = useCallback(async () => {
    if (pathData.length > 0) {
      try {
        const userName = pathData[0].userName;
        const predictedPath = await predictFutureRoute(userName);
        setFuturePathData(predictedPath);
      } catch (error) {
        console.error("Error al obtener predicción de ruta:", error);
      }
    }
  }, [pathData]);

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

    // Si showPaths es true y hay datos de ruta, mostrar las rutas
    if (showPaths && pathData.length > 0 && mapRef.current) {
      // Obtener predicción de ruta futura
      getFuturePathPrediction();

      // Limpiar rutas anteriores
      if (pastPathRef.current) {
        pastPathRef.current.remove();
      }

      // Ordenar los puntos por timestamp
      const sortedPathData = [...pathData].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Crear polyline para la ruta pasada
      const pastPathPoints = sortedPathData.map(
        (point) => [point.latitude, point.longitude] as [number, number]
      );

      if (pastPathPoints.length > 0) {
        pastPathRef.current = L.polyline(pastPathPoints, {
          color: "blue",
          weight: 3,
          opacity: 0.7,
        }).addTo(mapRef.current);

        // Ajustar el mapa para mostrar toda la ruta
        mapRef.current.fitBounds(pastPathRef.current.getBounds(), {
          padding: [50, 50],
        });
      }
    }

    return () => {
      // No destruimos el mapa aquí para evitar problemas con el renderizado
    };
  }, [location, pathData, showPaths, getFuturePathPrediction]);

  // Efecto para mostrar la ruta futura cuando se obtiene la predicción
  useEffect(() => {
    if (showPaths && futurePathData.length > 0 && mapRef.current) {
      // Limpiar ruta futura anterior
      if (futurePathRef.current) {
        futurePathRef.current.remove();
      }

      // Crear polyline para la ruta futura
      const futurePathPoints = futurePathData.map(
        (point) => [point.latitude, point.longitude] as [number, number]
      );

      if (futurePathPoints.length > 0) {
        futurePathRef.current = L.polyline(futurePathPoints, {
          color: "red",
          weight: 3,
          opacity: 0.7,
          dashArray: "5, 10",
        }).addTo(mapRef.current);
      }
    }
  }, [futurePathData, showPaths]);

  return <div id="map" className="h-full w-full" />;
}

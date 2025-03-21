"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MapPin, Wifi, Send } from "lucide-react";
import dynamic from "next/dynamic";
import { publishLocationToAWS } from "@/lib/aws-iot";

// Importamos el mapa dinámicamente para evitar problemas de SSR
const MapComponent = dynamic(() => import("@/components/map"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full bg-muted flex items-center justify-center">
      Cargando mapa...
    </div>
  ),
});

// ID único para este dispositivo
const DEVICE_ID = "web-client-" + Math.random().toString(36).substring(2, 9);

export default function GeolocalizacionPage() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [watchId, setWatchId] = useState<number | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Desconectado");
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Función para obtener la ubicación actual
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("La geolocalización no está soportada por tu navegador");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(newLocation);
        setError(null);
      },
      (err) => {
        setError(`Error al obtener la ubicación: ${err.message}`);
      },
      { enableHighAccuracy: true }
    );
  };

  // Función para iniciar/detener el seguimiento continuo
  const toggleTracking = () => {
    if (isTracking) {
      // Detener el seguimiento
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      setIsTracking(false);
      setConnectionStatus("Desconectado");
    } else {
      // Iniciar el seguimiento
      if (!navigator.geolocation) {
        setError("La geolocalización no está soportada por tu navegador");
        return;
      }

      const id = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(newLocation);
          setError(null);

          // Enviar datos a AWS IoT
          sendLocationToAWS(newLocation);
        },
        (err) => {
          setError(`Error al obtener la ubicación: ${err.message}`);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      setWatchId(id);
      setIsTracking(true);
      setConnectionStatus("Conectado");
    }
  };

  // Función para enviar la ubicación a AWS IoT
  const sendLocationToAWS = async (locationData: {
    lat: number;
    lng: number;
  }) => {
    try {
      setIsSending(true);
      setConnectionStatus("Enviando...");

      await publishLocationToAWS({
        latitude: locationData.lat,
        longitude: locationData.lng,
        timestamp: new Date().toISOString(),
        deviceId: DEVICE_ID,
      });

      setLastSent(new Date().toLocaleTimeString());
      setConnectionStatus("Conectado");
      setError(null);
    } catch (err) {
      console.error("Error al enviar datos a AWS IoT:", err);
      setError(
        `Error al enviar datos a AWS IoT: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      setConnectionStatus("Error de conexión");
    } finally {
      setIsSending(false);
    }
  };

  // Obtener la ubicación al cargar la página
  useEffect(() => {
    getCurrentLocation();

    return () => {
      // Limpiar el watch al desmontar el componente
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Geolocalización en Ciudades Inteligentes
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Ubicación Actual
            </CardTitle>
            <CardDescription>
              Visualización de tu posición actual en el mapa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full rounded-md overflow-hidden">
              {location ? (
                <MapComponent location={location} />
              ) : (
                <div className="h-full w-full bg-muted flex items-center justify-center">
                  {error ? error : "Obteniendo ubicación..."}
                </div>
              )}
            </div>

            {location && (
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p>
                  <strong>Latitud:</strong> {location.lat.toFixed(6)}
                </p>
                <p>
                  <strong>Longitud:</strong> {location.lng.toFixed(6)}
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button onClick={getCurrentLocation} variant="outline">
              Actualizar Ubicación
            </Button>
            <Button
              onClick={toggleTracking}
              variant={isTracking ? "destructive" : "default"}
            >
              {isTracking ? "Detener Seguimiento" : "Iniciar Seguimiento"}
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Conexión AWS IoT
            </CardTitle>
            <CardDescription>
              Estado de la conexión y envío de datos a AWS IoT Core
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      connectionStatus === "Conectado"
                        ? "bg-green-500"
                        : connectionStatus === "Enviando..."
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  ></div>
                  <p className="font-medium">Estado: {connectionStatus}</p>
                </div>

                {lastSent && (
                  <p className="text-sm text-muted-foreground">
                    Último envío: {lastSent}
                  </p>
                )}
              </div>

              <div className="p-4 border rounded-md">
                <h3 className="font-medium mb-2">Datos enviados a AWS IoT:</h3>
                {location ? (
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-auto">
                    {JSON.stringify(
                      {
                        latitude: location.lat,
                        longitude: location.lng,
                        timestamp: new Date().toISOString(),
                        deviceId: DEVICE_ID,
                      },
                      null,
                      2
                    )}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No hay datos disponibles
                  </p>
                )}
              </div>

              {error && (
                <div className="p-4 border border-red-300 bg-red-50 rounded-md">
                  <h3 className="font-medium mb-2 text-red-700">Error:</h3>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => location && sendLocationToAWS(location)}
              disabled={!location || isTracking || isSending}
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar Datos Manualmente
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

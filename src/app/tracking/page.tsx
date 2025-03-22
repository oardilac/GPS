"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Wifi, Send, History, Route, Clock } from "lucide-react";
import dynamic from "next/dynamic";
import { publishLocationToAWS } from "@/lib/aws-iot";
import { fetchLocationHistory } from "@/lib/dynamodb";
import { Suspense } from "react";

// Define las interfaces para los tipos de datos
interface Location {
  lat: number;
  lng: number;
}

interface LocationHistoryItem {
  timestamp: string;
  latitude: number;
  longitude: number;
  deviceId: string;
  userName: string;
}

// Importamos el mapa dinámicamente para evitar problemas de SSR
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-8 px-4 text-center">
          Cargando información de seguimiento...
        </div>
      }
    >
      <TrackingPageContent />
    </Suspense>
  );
}

function TrackingPageContent() {
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

  const searchParams = useSearchParams();
  const userName = searchParams.get("name") || "Usuario";

  const [location, setLocation] = useState<Location | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Desconectado");
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [locationHistory, setLocationHistory] = useState<LocationHistoryItem[]>(
    []
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [autoSendInterval, setAutoSendInterval] =
    useState<NodeJS.Timeout | null>(null);
  const [isAutoSending, setIsAutoSending] = useState(false);

  // Función para obtener la ubicación actual
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("La geolocalización no está soportada por tu navegador");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation: Location = {
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

      // Detener también el envío automático si está activo
      if (isAutoSending) {
        toggleAutoSend();
      }
    } else {
      // Iniciar el seguimiento
      if (!navigator.geolocation) {
        setError("La geolocalización no está soportada por tu navegador");
        return;
      }

      const id = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation: Location = {
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

  // Función para activar/desactivar el envío automático cada minuto
  const toggleAutoSend = () => {
    if (isAutoSending) {
      // Detener el envío automático
      if (autoSendInterval) {
        clearInterval(autoSendInterval);
        setAutoSendInterval(null);
      }
      setIsAutoSending(false);
      setConnectionStatus("Conectado");
    } else {
      // Iniciar el envío automático cada minuto (60000 ms)
      const interval = setInterval(() => {
        if (location) {
          sendLocationToAWS(location);
        }
      }, 60000);

      setAutoSendInterval(interval);
      setIsAutoSending(true);
      setConnectionStatus("Envío automático activado");

      // Enviar una primera vez al activar
      if (location) {
        sendLocationToAWS(location);
      }
    }
  };

  // Función para enviar la ubicación a AWS IoT
  const sendLocationToAWS = async (locationData: Location) => {
    try {
      setIsSending(true);
      setConnectionStatus(
        isAutoSending ? "Envío automático en progreso..." : "Enviando..."
      );

      await publishLocationToAWS({
        latitude: locationData.lat,
        longitude: locationData.lng,
        timestamp: new Date().toISOString(),
        deviceId: DEVICE_ID,
        userName: userName,
      });

      setLastSent(new Date().toLocaleTimeString());
      setConnectionStatus(
        isAutoSending ? "Envío automático activado" : "Conectado"
      );
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

  // Función para cargar el historial de ubicaciones
  const loadLocationHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const history = await fetchLocationHistory(userName);
      setLocationHistory(history);
    } catch (err) {
      console.error("Error al cargar historial:", err);
      setError(
        `Error al cargar historial: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setIsLoadingHistory(false);
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

      // Limpiar el intervalo de envío automático
      if (autoSendInterval) {
        clearInterval(autoSendInterval);
      }
    };
  }, [watchId, autoSendInterval]);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-2 text-center">
        Seguimiento de Ubicación
      </h1>
      <h2 className="text-xl text-center mb-8 text-muted-foreground">
        Usuario: {userName}
      </h2>

      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="current">Ubicación Actual</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="routes">Rutas</TabsTrigger>
        </TabsList>

        <TabsContent value="current">
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
                            : connectionStatus === "Enviando..." ||
                              connectionStatus ===
                                "Envío automático activado" ||
                              connectionStatus ===
                                "Envío automático en progreso..."
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
                    <h3 className="font-medium mb-2">
                      Datos enviados a AWS IoT:
                    </h3>
                    {location ? (
                      <pre className="bg-muted p-3 rounded-md text-xs overflow-auto">
                        {JSON.stringify(
                          {
                            latitude: location.lat,
                            longitude: location.lng,
                            timestamp: new Date().toISOString(),
                            deviceId: DEVICE_ID,
                            userName: userName,
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
              <CardFooter className="flex flex-col gap-3">
                <Button
                  className="w-full"
                  onClick={() => location && sendLocationToAWS(location)}
                  disabled={
                    !location || isTracking || isSending || isAutoSending
                  }
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Datos Manualmente
                </Button>

                <Button
                  className="w-full"
                  onClick={toggleAutoSend}
                  variant={isAutoSending ? "destructive" : "outline"}
                  disabled={!location || isTracking}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {isAutoSending
                    ? "Detener Envío Automático"
                    : "Enviar Cada Minuto"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de Ubicaciones
              </CardTitle>
              <CardDescription>
                Registro de ubicaciones guardadas en DynamoDB
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Button
                  onClick={loadLocationHistory}
                  disabled={isLoadingHistory}
                >
                  {isLoadingHistory ? "Cargando..." : "Cargar Historial"}
                </Button>
              </div>

              {locationHistory.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-4 py-2 text-left">Fecha/Hora</th>
                          <th className="px-4 py-2 text-left">Latitud</th>
                          <th className="px-4 py-2 text-left">Longitud</th>
                          <th className="px-4 py-2 text-left">Dispositivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {locationHistory.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-4 py-2">
                              {new Date(item.timestamp).toLocaleString()}
                            </td>
                            <td className="px-4 py-2">
                              {item.latitude.toFixed(6)}
                            </td>
                            <td className="px-4 py-2">
                              {item.longitude.toFixed(6)}
                            </td>
                            <td className="px-4 py-2">{item.deviceId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  {isLoadingHistory
                    ? "Cargando datos..."
                    : "No hay datos de historial disponibles. Haz clic en 'Cargar Historial' para obtener los datos."}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routes">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                Visualización de Rutas
              </CardTitle>
              <CardDescription>
                Visualiza tus rutas pasadas y predicción de rutas futuras
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] w-full rounded-md overflow-hidden">
                {locationHistory.length > 0 ? (
                  <MapComponent
                    location={location || { lat: 0, lng: 0 }}
                    pathData={locationHistory}
                    showPaths={true}
                  />
                ) : (
                  <div className="h-full w-full bg-muted flex flex-col items-center justify-center">
                    <p className="mb-4">No hay datos de rutas disponibles</p>
                    <Button
                      onClick={loadLocationHistory}
                      disabled={isLoadingHistory}
                    >
                      {isLoadingHistory
                        ? "Cargando..."
                        : "Cargar Datos de Rutas"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <div className="w-full flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm">Ruta pasada</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Ubicación actual</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm">Predicción de ruta futura</span>
                </div>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Interfaz para los datos de ubicación
interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: string;
  deviceId: string;
}

// Función para publicar la ubicación en AWS IoT Core
export async function publishLocationToAWS(
  locationData: LocationData
): Promise<void> {
  try {
    // Aquí necesitarás configurar tus credenciales de AWS
    // Para la entrega 2, puedes usar la API Gateway como intermediario
    // o configurar Cognito para autenticación desde el navegador

    // Ejemplo usando una API Gateway (recomendado para web)
    const response = await fetch("/api/publish-location", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(locationData),
    });

    if (!response.ok) {
      throw new Error(`Error al publicar: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error al publicar en AWS IoT:", error);
    throw error;
  }
}

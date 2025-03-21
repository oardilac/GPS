export interface LocationData {
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
    // Usar la API REST como intermediario para publicar en AWS IoT
    const response = await fetch("/api/publish-location", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(locationData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error al publicar: ${errorData.error || response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error al publicar en AWS IoT:", error);
    throw error;
  }
}

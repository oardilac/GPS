import { LocationData } from "./types";

// Función para obtener el historial de ubicaciones de un usuario desde DynamoDB
export async function fetchLocationHistory(
  userName: string
): Promise<LocationData[]> {
  try {
    const response = await fetch(
      `/api/location-history?userName=${encodeURIComponent(userName)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error al obtener historial: ${errorData.error || response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error al obtener historial de DynamoDB:", error);
    throw error;
  }
}

// Función para predecir rutas futuras basadas en el historial
export async function predictFutureRoute(
  userName: string
): Promise<LocationData[]> {
  try {
    const response = await fetch(
      `/api/predict-route?userName=${encodeURIComponent(userName)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error al predecir ruta: ${errorData.error || response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error al predecir ruta futura:", error);
    throw error;
  }
}

import { NextResponse } from "next/server";
import AWS from "aws-sdk";
import { LocationData } from "@/lib/types";

// Configurar AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Crear cliente de DynamoDB
const dynamoDB = new AWS.DynamoDB.DocumentClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userName = searchParams.get("userName");

    if (!userName) {
      return NextResponse.json(
        { error: "Se requiere el nombre de usuario" },
        { status: 400 }
      );
    }

    // Enfoque 1: Usar el índice correcto
    const params = {
      TableName: "GPS_Locations",
      IndexName: "userName-UserNameIndex-index", // Nombre correcto del índice
      KeyConditionExpression: "userName = :userName",
      ExpressionAttributeValues: {
        ":userName": userName,
      },
      ScanIndexForward: true, // Ordenar por timestamp ascendente
      Limit: 20, // Obtener los últimos 20 puntos para la predicción
    };

    // Alternativa: escanear la tabla si el índice sigue fallando
    /* 
    const params = {
      TableName: "GPS_Locations",
      FilterExpression: "userName = :userName",
      ExpressionAttributeValues: {
        ":userName": userName,
      },
      Limit: 20,
    };
    
    const result = await dynamoDB.scan(params).promise();
    */

    const result = await dynamoDB.query(params).promise();
    const historyPoints = result.Items || [];

    // Si no hay suficientes puntos para predecir, devolver un array vacío
    if (historyPoints.length < 3) {
      return NextResponse.json([]);
    }

    // Algoritmo simple de predicción basado en la tendencia de los últimos puntos
    // En un caso real, esto podría ser un modelo de ML más sofisticado
    const predictedPoints = predictFuturePoints(
      historyPoints as LocationData[]
    );

    return NextResponse.json(predictedPoints);
  } catch (error) {
    console.error("Error al predecir ruta:", error);

    return NextResponse.json(
      {
        error: "Error al predecir ruta futura",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Función para predecir puntos futuros basados en el historial
function predictFuturePoints(historyPoints: LocationData[]): LocationData[] {
  // Ordenar por timestamp para asegurar que están en orden cronológico
  const sortedPoints = [...historyPoints].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Si hay menos de 2 puntos, no podemos predecir
  if (sortedPoints.length < 2) {
    return [];
  }

  // Obtener los últimos dos puntos para calcular la dirección y velocidad
  const lastPoint = sortedPoints[sortedPoints.length - 1];
  const secondLastPoint = sortedPoints[sortedPoints.length - 2];

  // Calcular el vector de dirección
  const deltaLat = lastPoint.latitude - secondLastPoint.latitude;
  const deltaLng = lastPoint.longitude - secondLastPoint.longitude;

  // Calcular el tiempo transcurrido entre los dos últimos puntos (en milisegundos)
  const deltaTime =
    new Date(lastPoint.timestamp).getTime() -
    new Date(secondLastPoint.timestamp).getTime();

  // Predecir 5 puntos futuros
  const predictedPoints: LocationData[] = [];
  let lastPredictedTime = new Date(lastPoint.timestamp).getTime();
  let lastPredictedLat = lastPoint.latitude;
  let lastPredictedLng = lastPoint.longitude;

  for (let i = 0; i < 5; i++) {
    // Incrementar el tiempo (asumimos el mismo intervalo que entre los últimos dos puntos)
    lastPredictedTime += deltaTime;

    // Calcular nuevas coordenadas
    lastPredictedLat += deltaLat;
    lastPredictedLng += deltaLng;

    // Añadir el punto predicho
    predictedPoints.push({
      latitude: lastPredictedLat,
      longitude: lastPredictedLng,
      timestamp: new Date(lastPredictedTime).toISOString(),
      deviceId: lastPoint.deviceId,
      userName: lastPoint.userName,
    });
  }

  return predictedPoints;
}

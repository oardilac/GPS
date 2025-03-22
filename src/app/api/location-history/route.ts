import { NextResponse } from "next/server";
import AWS from "aws-sdk";

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

    // Usar scan con filtro en lugar de query con índice
    const params = {
      TableName: "GPS_Locations",
      FilterExpression: "userName = :userName",
      ExpressionAttributeValues: {
        ":userName": userName,
      },
      Limit: 100,
    };

    const result = await dynamoDB.scan(params).promise();

    // Ordenar los resultados manualmente por timestamp (más reciente primero)
    const sortedItems =
      result.Items?.sort((a, b) => {
        return (
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      }) || [];

    return NextResponse.json(sortedItems);
  } catch (error) {
    console.error("Error al consultar DynamoDB:", error);

    return NextResponse.json(
      {
        error: "Error al obtener historial de ubicaciones",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import AWS from "aws-sdk";

// Configurar AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Crear cliente de IoT Data
const iotdata = new AWS.IotData({
  endpoint: process.env.AWS_IOT_ENDPOINT,
});

export async function POST(request: Request) {
  try {
    const locationData = await request.json();

    // Validar los datos recibidos
    if (!locationData.latitude || !locationData.longitude) {
      return NextResponse.json(
        { error: "Se requieren latitud y longitud" },
        { status: 400 }
      );
    }

    // Preparar el mensaje para AWS IoT
    const params = {
      topic: "devices/location",
      payload: JSON.stringify(locationData),
      qos: 0,
    };

    // Publicar el mensaje
    await iotdata.publish(params).promise();

    return NextResponse.json({
      success: true,
      message: "Ubicación publicada correctamente",
    });
  } catch (error) {
    console.error("Error al publicar en AWS IoT:", error);

    return NextResponse.json(
      {
        error: "Error al publicar en AWS IoT",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: string;
  deviceId: string;
  userName: string;
}

export interface PathPoint {
  lat: number;
  lng: number;
  timestamp: string;
  type: "past" | "future";
}

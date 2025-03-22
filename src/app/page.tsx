"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const [userName, setUserName] = useState("");

  return (
    <div className="container mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Sistema de Seguimiento GPS
      </h1>

      <Card className="max-w-md mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-6 w-6" />
            Ingresa tu nombre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Nombre completo"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>
            <Button className="w-full" disabled={!userName.trim()} asChild>
              <Link href={`/tracking?name=${encodeURIComponent(userName)}`}>
                Continuar
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

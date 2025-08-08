import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <>
      <Header title="Configurações" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Configurações da Conta</CardTitle>
            <CardDescription>Gerencie as informações da sua conta.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* O conteúdo das configurações irá aqui */}
            <p>Em breve.</p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

import { Header } from "@/components/dashboard/header";

export default function InfluencerRecompensasPage() {
  return (
    <>
      <Header title="Recompensas" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Conteúdo de Recompensas do Influenciador</p>
        </div>
      </main>
    </>
  );
}

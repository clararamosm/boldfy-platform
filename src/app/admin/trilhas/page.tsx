import { Header } from "@/components/dashboard/header";

export default function AdminTrilhasPage() {
  return (
    <>
      <Header title="Trilhas" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Conteúdo de Trilhas do Admin</p>
        </div>
      </main>
    </>
  );
}

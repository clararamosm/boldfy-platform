import { Header } from "@/components/dashboard/header";

export default function AdminBibliotecaPage() {
  return (
    <>
      <Header title="Biblioteca" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Conteúdo da Biblioteca do Admin</p>
        </div>
      </main>
    </>
  );
}

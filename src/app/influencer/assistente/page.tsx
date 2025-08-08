import { Header } from "@/components/dashboard/header";
import { AiAssistantForm } from "@/components/ai-assistant-form";

export default function AiAssistantPage() {
  return (
    <>
      <Header title="Assistente de Conteúdo IA" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <AiAssistantForm companyId="company-123" />
      </main>
    </>
  );
}

import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Folder, FileText, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function AdminBibliotecaPage() {
  const uploadButton = (
     <Button size="sm">
        <PlusCircle className="mr-2 h-4 w-4" />
        Novo Upload
      </Button>
  );

  const uploadForm = (
    <>
      <div className="space-y-2">
        <Label htmlFor="asset-name">Nome do Ativo</Label>
        <Input id="asset-name" placeholder="Ex: Banner para LinkedIn" />
      </div>
       <div className="space-y-2">
        <Label htmlFor="asset-category">Categoria</Label>
        <Input id="asset-category" placeholder="Ex: Banners" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="asset-file">Arquivo</Label>
        <Input id="asset-file" type="file" />
      </div>
    </>
  );


  return (
    <>
      <Header title="Biblioteca" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline">Gerenciar Ativos</CardTitle>
              <CardDescription>Faça upload e gerencie os ativos da sua marca.</CardDescription>
            </div>
             <ActionDialog
              title="Novo Upload"
              description="Faça o upload de um novo ativo para a biblioteca da sua marca."
              trigger={uploadButton}
              actionText="Fazer Upload"
            >
              {uploadForm}
            </ActionDialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Ativo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                   <TableHead>Data de Upload</TableHead>
                  <TableHead><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    Banner LinkedIn - Lançamento
                  </TableCell>
                  <TableCell>Imagem (PNG)</TableCell>
                  <TableCell>
                    <Badge variant="outline">Banners</Badge>
                  </TableCell>
                  <TableCell>2024-07-15</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Baixar</DropdownMenuItem>
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                <TableRow>
                   <TableCell className="font-medium flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    Guia de Tom de Voz
                  </TableCell>
                  <TableCell>Documento (PDF)</TableCell>
                   <TableCell>
                    <Badge variant="outline">Documentos</Badge>
                  </TableCell>
                  <TableCell>2024-06-20</TableCell>
                   <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Baixar</DropdownMenuItem>
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

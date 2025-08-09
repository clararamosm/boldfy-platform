import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function AdminColaboradoresPage() {
  const inviteButton = (
    <Button size="sm">
      <PlusCircle className="mr-2 h-4 w-4" />
      Convidar Colaborador
    </Button>
  );

  return (
    <>
      <Header title="Colaboradores" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline">Gerenciar Colaboradores</CardTitle>
              <CardDescription>Adicione, edite ou remova colaboradores da plataforma.</CardDescription>
            </div>
            <ActionDialog
              title="Convidar Colaborador"
              description="Envie um convite por e-mail para um novo colaborador se juntar à plataforma."
              trigger={inviteButton}
              actionText="Enviar Convite"
            >
              <div className="space-y-2">
                <Label htmlFor="email">E-mail do Colaborador</Label>
                <Input id="email" type="email" placeholder="nome@empresa.com.br" />
              </div>
            </ActionDialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Pontos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Entrada</TableHead>
                  <TableHead><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint="person avatar" />
                        <AvatarFallback>CC</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">Carla Costa</p>
                        <p className="text-sm text-muted-foreground">carla@boldfy.com.br</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>1250</TableCell>
                  <TableCell><Badge variant="default">Ativo</Badge></TableCell>
                  <TableCell>2023-10-01</TableCell>
                   <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                          <DropdownMenuItem>Ver Perfil</DropdownMenuItem>
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">Desativar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                 <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint="person avatar" />
                        <AvatarFallback>JP</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">João Paulo</p>
                        <p className="text-sm text-muted-foreground">joao@boldfy.com.br</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>890</TableCell>
                  <TableCell><Badge variant="default">Ativo</Badge></TableCell>
                  <TableCell>2023-11-15</TableCell>
                   <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                          <DropdownMenuItem>Ver Perfil</DropdownMenuItem>
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">Desativar</DropdownMenuItem>
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

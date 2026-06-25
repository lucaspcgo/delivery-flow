import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Configurações — Zero Tempo" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div>
      <PageHeader title="Configurações" description="Gerencie sua conta, empresa, plano e segurança." />
      <div className="p-4 sm:p-8">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-4">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="company">Empresa</TabsTrigger>
            <TabsTrigger value="plan">Plano</TabsTrigger>
            <TabsTrigger value="security">Segurança</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card className="max-w-2xl p-6">
              <div className="grid gap-4">
                <div className="grid gap-2"><Label>Nome</Label><Input defaultValue="Restaurante Admin" /></div>
                <div className="grid gap-2"><Label>Email</Label><Input defaultValue="admin@zerotempo.com" /></div>
                <div className="grid gap-2"><Label>Telefone</Label><Input defaultValue="(11) 99999-0000" /></div>
                <Button className="w-fit" onClick={() => toast.success("Perfil atualizado")}>Salvar</Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="company" className="mt-6">
            <Card className="max-w-2xl p-6">
              <div className="grid gap-4">
                <div className="grid gap-2"><Label>Razão Social</Label><Input defaultValue="Delivery Pro Ltda" /></div>
                <div className="grid gap-2"><Label>CNPJ</Label><Input defaultValue="12.345.678/0001-90" /></div>
                <div className="grid gap-2"><Label>Endereço fiscal</Label><Input defaultValue="Av. Paulista, 1000 - São Paulo/SP" /></div>
                <Button className="w-fit" onClick={() => toast.success("Empresa atualizada")}>Salvar</Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="plan" className="mt-6">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { name: "Starter", price: "R$ 99", features: ["1 loja", "300 pedidos/mês", "Integrações básicas"] },
                { name: "Pro", price: "R$ 249", features: ["5 lojas", "Pedidos ilimitados", "Todas as automações", "Suporte prioritário"], current: true },
                { name: "Enterprise", price: "Sob consulta", features: ["Lojas ilimitadas", "API dedicada", "Gerente de conta"] },
              ].map((p) => (
                <Card key={p.name} className={`p-6 ${p.current ? "border-primary ring-2 ring-primary/20" : ""}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{p.name}</h3>
                    {p.current && <Badge>Plano atual</Badge>}
                  </div>
                  <p className="mt-4 text-2xl font-semibold">{p.price}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />{f}</li>
                    ))}
                  </ul>
                  <Button variant={p.current ? "outline" : "default"} className="mt-6 w-full">{p.current ? "Plano atual" : "Selecionar"}</Button>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <Card className="max-w-2xl space-y-5 p-6">
              <div className="grid gap-2"><Label>Senha atual</Label><Input type="password" /></div>
              <div className="grid gap-2"><Label>Nova senha</Label><Input type="password" /></div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">Autenticação em dois fatores</p>
                  <p className="text-xs text-muted-foreground">Adicione uma camada extra de proteção ao login.</p>
                </div>
                <Switch />
              </div>
              <Button className="w-fit" onClick={() => toast.success("Segurança atualizada")}>Salvar</Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
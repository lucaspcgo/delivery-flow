import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Store as StoreIcon, Phone, MapPin } from "lucide-react";
import { stores as initial, type Store } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/restaurants")({
  head: () => ({ meta: [{ title: "Restaurantes — Delivery Auto Pro" }] }),
  component: RestaurantsPage,
});

function RestaurantsPage() {
  const [list, setList] = useState<Store[]>(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", cnpj: "", phone: "", address: "" });

  const toggle = (id: string) => setList((p) => p.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));

  const save = () => {
    if (!form.name) return toast.error("Informe o nome da loja");
    setList((p) => [...p, { id: `s${p.length + 1}`, ...form, active: true, ordersToday: 0 }]);
    setForm({ name: "", cnpj: "", phone: "", address: "" });
    setOpen(false);
    toast.success("Loja cadastrada");
  };

  return (
    <div>
      <PageHeader
        title="Restaurantes"
        description="Gerencie suas lojas e unidades cadastradas."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Nova loja</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar restaurante</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2"><Label>Nome da loja</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid gap-2"><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></div>
                <div className="grid gap-2"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-4 p-4 sm:p-8 md:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <StoreIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-tight">{s.name}</h3>
                  <p className="text-xs text-muted-foreground">{s.cnpj}</p>
                </div>
              </div>
              <Badge variant="outline" className={s.active ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}>
                {s.active ? "Ativa" : "Inativa"}
              </Badge>
            </div>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0" />{s.phone}</p>
              <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{s.address}</p>
            </div>
            <div className="mt-5 flex items-center justify-between border-t pt-4">
              <div>
                <p className="text-xs text-muted-foreground">Pedidos hoje</p>
                <p className="text-lg font-semibold">{s.ordersToday}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Status</span>
                <Switch checked={s.active} onCheckedChange={() => toggle(s.id)} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function StoreSelector() {
  return (
    <Select defaultValue="all">
      <SelectTrigger className="h-9 w-full sm:w-[180px]">
        <SelectValue placeholder="Selecione a loja" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as lojas</SelectItem>
        <SelectItem value="s1">Burger House - Centro</SelectItem>
        <SelectItem value="s2">Pizzaria Bella - Moema</SelectItem>
        <SelectItem value="s3">Sushi Yama - Pinheiros</SelectItem>
      </SelectContent>
    </Select>
  );
}

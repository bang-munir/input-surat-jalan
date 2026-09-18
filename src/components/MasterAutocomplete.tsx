import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type MasterListItem = {
  id: string;
  nama: string;
  alamat: string;
  telepon: string;
};

const inputStitch =
  "h-11 rounded-lg border-0 bg-[#eff4ff] px-3.5 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#a33900]/40";

export function MasterAutocomplete({
  items,
  loading,
  value,
  placeholder,
  emptyLabel,
  required,
  onInputChange,
  onSelect,
}: {
  items: MasterListItem[];
  loading: boolean;
  value: string;
  placeholder: string;
  emptyLabel: string;
  required?: boolean;
  onInputChange: (value: string) => void;
  onSelect: (item: MasterListItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const query = value.trim().toLocaleLowerCase("id-ID");
  const filtered = useMemo(() => {
    if (!query) return items;
    return items.filter((i) => i.nama.toLocaleLowerCase("id-ID").includes(query));
  }, [items, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            value={value}
            type="text"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            placeholder={placeholder}
            required={required}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              onInputChange(e.target.value);
              setOpen(true);
            }}
            className={cn(inputStitch, "pr-9")}
          />
          <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandList>
            {loading ? (
              <div className="space-y-1.5 p-3">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-2/3" />
              </div>
            ) : (
              <>
                <CommandEmpty>{emptyLabel}</CommandEmpty>
                <CommandGroup>
                  {filtered.map((item) => {
                    const isSelected = value.trim() === item.nama;
                    return (
                      <CommandItem
                        key={item.id}
                        value={item.nama}
                        onSelect={() => {
                          onSelect(item);
                          setOpen(false);
                        }}
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="truncate">{item.nama}</span>
                          {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

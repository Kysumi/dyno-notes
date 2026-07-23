import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox.tsx";
import { cn } from "@/lib/utils.ts";
import type { ComboboxRootChangeEventReason } from "@base-ui/react/combobox";

export type SearchableSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SearchableSelectProps = {
  options: readonly SearchableSelectOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  open?: boolean;
  onOpenChange?: (open: boolean, reason: ComboboxRootChangeEventReason) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function SearchableSelect({
  options,
  value,
  onValueChange,
  open,
  onOpenChange,
  placeholder = "Select an option…",
  emptyMessage = "No options found.",
  disabled = false,
  clearable = false,
  className,
  "aria-label": ariaLabel,
}: SearchableSelectProps) {
  const selectedOption =
    options.find((option) => option.value === value) ?? null;

  return (
    <Combobox
      items={options}
      value={selectedOption}
      onValueChange={(option) => onValueChange(option?.value ?? null)}
      open={open}
      onOpenChange={(open, details) => onOpenChange?.(open, details.reason)}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={(option, selected) => option.value === selected.value}
    >
      <ComboboxInput
        aria-label={ariaLabel}
        placeholder={placeholder}
        disabled={disabled}
        showClear={clearable}
        className={cn("w-full", className)}
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        <ComboboxList>
          {(option: SearchableSelectOption) => (
            <ComboboxItem
              key={option.value}
              value={option}
              disabled={option.disabled}
            >
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

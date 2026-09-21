export const inputClass =
  "rounded-xl border border-(--color-ocean)/50 bg-(--color-night) px-4 py-3 text-(--color-light) outline-none focus:border-(--color-sand)";

const inputErrorClass = "border-red-400 focus:border-red-400";

export const labelClass = "flex flex-col gap-1.5 text-sm";
export const legendClass = "text-(--color-sand)";

export function fieldClass(error?: string) {
  return error ? `${inputClass} ${inputErrorClass}` : inputClass;
}

export function fieldsetErrorClass(hasError: boolean) {
  return hasError ? "rounded-lg border border-red-400 p-3" : "";
}

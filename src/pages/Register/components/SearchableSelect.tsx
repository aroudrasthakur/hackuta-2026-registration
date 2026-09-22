import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { FieldError, RequiredMark } from "./FormFields";
import { fieldClass, labelClass, legendClass } from "./formFieldStyles";

const MAX_RESULTS = 50;

type SearchableSelectProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string | undefined;
  placeholder?: string;
  value: string;
  options: readonly string[];
  /** Shown when the query is empty (e.g. regional schools before search). */
  featuredOptions?: readonly string[];
  onChange: (value: string) => void;
};

export function SearchableSelect({
  id,
  label,
  required,
  error,
  placeholder = "Search and select one",
  value,
  options,
  featuredOptions,
  onChange,
}: SearchableSelectProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      if (featuredOptions?.length) {
        return [...featuredOptions];
      }
      return options.slice(0, MAX_RESULTS);
    }
    return options
      .filter((option) => option.toLowerCase().includes(normalized))
      .slice(0, MAX_RESULTS);
  }, [featuredOptions, options, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filteredOptions]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [value]);

  const errorId = `${id}-error`;

  const selectOption = (option: string) => {
    onChange(option);
    setQuery(option);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" && open && filteredOptions[activeIndex]) {
      event.preventDefault();
      selectOption(filteredOptions[activeIndex]!);
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setQuery(value);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className={labelClass} htmlFor={id}>
        <span className={legendClass}>
          {label}
          {required ? <RequiredMark /> : null}
        </span>
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={fieldClass(error)}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (!event.target.value.trim()) {
              onChange("");
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <FieldError id={errorId} message={error} />
      </label>

      {open && filteredOptions.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border-2 border-(--sand) bg-white py-1 shadow-lg"
        >
          {filteredOptions.map((option, index) => (
            <li key={option} role="option" aria-selected={option === value}>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-(--clay) ${
                  index === activeIndex || option === value
                    ? "bg-(--clay) font-medium text-(--ink)"
                    : "text-(--ink)"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

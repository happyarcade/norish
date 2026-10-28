"use client";

import type { ReactElement, ReactNode } from "react";
import { Children, isValidElement, useId } from "react";
import { Description, InputGroup, Label, Spinner, TextField } from "@heroui-v3/react";

import { cx } from "./classnames";

type Selection = "all" | Set<React.Key>;

interface SelectItemProps {
  children?: ReactNode;
  textValue?: string;
  value?: string;
}

export function SelectItem(_props: SelectItemProps) {
  return null;
}

interface SelectProps {
  "aria-label"?: string;
  children: ReactNode;
  className?: string;
  classNames?: { trigger?: string };
  description?: ReactNode;
  isDisabled?: boolean;
  label?: ReactNode;
  placeholder?: string;
  selectedKeys?: Iterable<React.Key>;
  size?: "sm" | "md" | "lg";
  onSelectionChange?: (keys: Selection) => void;
}

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement<{ children?: ReactNode }>(node)) return "";
  return textFromNode(node.props.children);
}

export function Select({
  "aria-label": ariaLabel,
  children,
  className,
  classNames,
  description,
  isDisabled,
  label,
  placeholder,
  selectedKeys,
  size,
  onSelectionChange,
}: SelectProps) {
  const selectedKey = selectedKeys ? Array.from(selectedKeys)[0] : "";

  return (
    <TextField fullWidth className={className} isDisabled={isDisabled}>
      {label ? <Label>{label}</Label> : null}
      <InputGroup
        fullWidth
        className={cx(classNames?.trigger, size === "sm" && "min-h-9", size === "lg" && "min-h-12")}
        variant="secondary"
      >
        <select
          aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
          className="text-foreground h-full w-full appearance-none bg-transparent px-3 py-2 text-sm outline-none"
          disabled={isDisabled}
          value={selectedKey == null ? "" : String(selectedKey)}
          onChange={(event) => onSelectionChange?.(new Set([event.currentTarget.value]))}
        >
          {placeholder ? (
            <option disabled value="">
              {placeholder}
            </option>
          ) : null}
          {Children.map(children, (child) => {
            if (!isValidElement<SelectItemProps>(child)) return null;
            const value = child.props.value ?? (child.key == null ? "" : String(child.key));
            const text = child.props.textValue ?? textFromNode(child.props.children);

            return (
              <option key={value} value={value}>
                {text}
              </option>
            );
          })}
        </select>
        <InputGroup.Suffix aria-hidden="true">&#9662;</InputGroup.Suffix>
      </InputGroup>
      {description ? <Description>{description}</Description> : null}
    </TextField>
  );
}

type AutocompleteItemProps = SelectItemProps;

export function AutocompleteItem(_props: AutocompleteItemProps) {
  return null;
}

interface AutocompleteProps<T> {
  allowsCustomValue?: boolean;
  children: (item: T) => ReactElement<AutocompleteItemProps>;
  defaultItems?: T[];
  description?: ReactNode;
  inputValue?: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  label?: ReactNode;
  placeholder?: string;
  onInputChange?: (value: string) => void;
  onSelectionChange?: (key: React.Key | null) => void;
}

export function Autocomplete<T>({
  children,
  defaultItems = [],
  description,
  inputValue,
  isDisabled,
  isLoading,
  label,
  placeholder,
  onInputChange,
  onSelectionChange,
}: AutocompleteProps<T>) {
  const listId = useId();
  const options = defaultItems.map((item) => {
    const element = children(item);
    const value = element.key == null ? "" : String(element.key);
    const text = element.props.textValue ?? textFromNode(element.props.children);

    return { text, value };
  });

  return (
    <TextField fullWidth isDisabled={isDisabled}>
      {label ? <Label>{label}</Label> : null}
      <InputGroup fullWidth variant="secondary">
        <InputGroup.Input
          list={listId}
          placeholder={placeholder}
          value={inputValue}
          onChange={(event) => {
            const value = event.currentTarget.value;
            onInputChange?.(value);
            if (options.some((option) => option.value === value)) onSelectionChange?.(value);
          }}
        />
        {isLoading ? (
          <InputGroup.Suffix>
            <Spinner size="sm" />
          </InputGroup.Suffix>
        ) : null}
      </InputGroup>
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.text}
          </option>
        ))}
      </datalist>
      {description ? <Description>{description}</Description> : null}
    </TextField>
  );
}

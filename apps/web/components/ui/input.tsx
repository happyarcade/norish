"use client";

import type { ComponentProps, ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/16/solid";
import {
  Description,
  FieldError,
  Input as HeroUIInput,
  InputGroup,
  Label,
  TextField,
} from "@heroui-v3/react";

import { cx } from "./classnames";

type HeroUIInputProps = ComponentProps<typeof HeroUIInput>;

interface InputProps extends Omit<HeroUIInputProps, "className" | "size" | "variant"> {
  className?: string;
  classNames?: {
    base?: string;
    input?: string;
    inputWrapper?: string;
    label?: string;
  };
  description?: ReactNode;
  endContent?: ReactNode;
  errorMessage?: ReactNode;
  isDisabled?: boolean;
  isClearable?: boolean;
  isInvalid?: boolean;
  isRequired?: boolean;
  label?: ReactNode;
  radius?: "none" | "sm" | "md" | "lg" | "full";
  size?: "sm" | "md" | "lg";
  startContent?: ReactNode;
  variant?: "bordered" | "faded" | "flat" | "underlined";
  onClear?: () => void;
  onValueChange?: (value: string) => void;
}

function radiusClass(radius: InputProps["radius"]): string | undefined {
  if (radius === "none") return "rounded-none";
  if (radius === "sm") return "rounded-sm";
  if (radius === "md") return "rounded-md";
  if (radius === "lg") return "rounded-lg";
  if (radius === "full") return "rounded-full";
  return undefined;
}

/** HeroUI v3 text field with the app's established compact field props. */
export function Input({
  className,
  classNames,
  description,
  endContent,
  errorMessage,
  isDisabled,
  isClearable,
  isInvalid,
  isRequired,
  label,
  radius,
  size,
  startContent,
  variant,
  onClear,
  onChange,
  onValueChange,
  ...inputProps
}: InputProps) {
  return (
    <TextField
      fullWidth
      className={cx(classNames?.base, className)}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      isRequired={isRequired}
    >
      {label ? <Label className={classNames?.label}>{label}</Label> : null}
      <InputGroup
        fullWidth
        className={cx(
          classNames?.inputWrapper,
          radiusClass(radius),
          size === "sm" && "min-h-9",
          size === "lg" && "min-h-12"
        )}
        variant={variant === "underlined" ? "primary" : "secondary"}
      >
        {startContent ? <InputGroup.Prefix>{startContent}</InputGroup.Prefix> : null}
        <InputGroup.Input
          {...inputProps}
          className={classNames?.input}
          onChange={(event) => {
            onChange?.(event);
            onValueChange?.(event.currentTarget.value);
          }}
        />
        {isClearable || endContent ? (
          <InputGroup.Suffix className="flex items-center gap-1">
            {isClearable && inputProps.value ? (
              <button aria-label="Clear" type="button" onClick={onClear}>
                <XMarkIcon className="h-4 w-4" />
              </button>
            ) : null}
            {endContent}
          </InputGroup.Suffix>
        ) : null}
      </InputGroup>
      {description ? <Description>{description}</Description> : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </TextField>
  );
}

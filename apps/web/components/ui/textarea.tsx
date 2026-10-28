"use client";

import type { ChangeEventHandler } from "react";
import { Description, FieldError, InputGroup, Label, TextField } from "@heroui-v3/react";

import { cx } from "./classnames";

interface TextareaProps {
  className?: string;
  classNames?: {
    base?: string;
    input?: string;
    inputWrapper?: string;
  };
  description?: string;
  errorMessage?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  label?: string;
  maxRows?: number;
  minRows?: number;
  placeholder?: string;
  value?: string;
  onBlur?: ChangeEventHandler<HTMLTextAreaElement>;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  onValueChange?: (value: string) => void;
}

/** App text area field backed by HeroUI v3's compound field primitives. */
export function Textarea({
  className,
  classNames,
  description,
  errorMessage,
  isDisabled,
  isInvalid,
  label,
  minRows = 3,
  placeholder,
  value,
  onBlur,
  onChange,
  onValueChange,
}: TextareaProps) {
  return (
    <TextField
      fullWidth
      className={cx(classNames?.base, className)}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
    >
      {label ? <Label>{label}</Label> : null}
      <InputGroup fullWidth className={classNames?.inputWrapper} variant="secondary">
        <InputGroup.TextArea
          className={classNames?.input}
          placeholder={placeholder}
          rows={minRows}
          value={value}
          onBlur={onBlur}
          onChange={(event) => {
            onChange?.(event);
            onValueChange?.(event.currentTarget.value);
          }}
        />
      </InputGroup>
      {description ? <Description>{description}</Description> : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </TextField>
  );
}

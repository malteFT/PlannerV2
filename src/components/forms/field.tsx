"use client";

/**
 * Schlanker Form-Wrapper über react-hook-form (statt shadcn-Form).
 *
 * Bewusst minimal: ein Field-Wrapper, der Label + Input + Error rendert.
 * Komplexere Custom-Renders machen wir mit Controller direkt am Use-Site.
 */
import * as React from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps<TValues extends FieldValues, TName extends FieldPath<TValues>> = {
  control: Control<TValues>;
  name: TName;
  label?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: (field: {
    value: TValues[TName] | undefined;
    onChange: (v: TValues[TName] | undefined | unknown) => void;
    onBlur: () => void;
    name: TName;
    ref: React.Ref<unknown>;
    invalid: boolean;
    error?: string;
  }) => React.ReactNode;
};

export function Field<TValues extends FieldValues, TName extends FieldPath<TValues>>(
  props: FieldProps<TValues, TName>,
) {
  const { control, name, label, description, className, children } = props;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={cn("flex flex-col gap-2", className)}>
          {label && (
            <Label htmlFor={String(name)} className="text-sm">
              {label}
            </Label>
          )}
          {children({
            value: field.value,
            onChange: field.onChange,
            onBlur: field.onBlur,
            name: field.name as TName,
            ref: field.ref,
            invalid: !!fieldState.error,
            error: fieldState.error?.message as string | undefined,
          })}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {fieldState.error?.message && (
            <p className="text-xs text-red-600" role="alert">
              {fieldState.error.message as string}
            </p>
          )}
        </div>
      )}
    />
  );
}

/**
 * Globale Form-Fehlermeldung (z.B. aus Server-Action).
 */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}

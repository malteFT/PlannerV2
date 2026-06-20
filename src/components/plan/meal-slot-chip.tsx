import * as React from "react";

import { cn } from "@/lib/utils";
import { MEAL_SLOT_LABELS, type MealSlot } from "@/lib/db/types";

const SLOT_CLASS: Record<MealSlot, string> = {
  breakfast: "slot-chip slot-breakfast",
  lunch: "slot-chip slot-lunch",
  dinner: "slot-chip slot-dinner",
  snack: "slot-chip slot-snack",
};

type Props = {
  slot: MealSlot;
  className?: string;
};

/**
 * Kleines, farbiges Mahlzeit-Slot-Label.
 *
 * Genutzt überall dort, wo heute ein Outline-Badge mit dem Slot-Namen steht
 * (Plan-Mahlzeiten, Rezept-Liste, Historie). Form-Labels und Sätze in
 * aria-Strings nutzen weiterhin direkt `MEAL_SLOT_LABELS[slot]`.
 */
export function MealSlotChip({ slot, className }: Props) {
  return <span className={cn(SLOT_CLASS[slot], className)}>{MEAL_SLOT_LABELS[slot]}</span>;
}

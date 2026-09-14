"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Opens the browser's print dialog.
 *
 * "Save as PDF" is a destination in that dialog on every current desktop
 * browser, which is how this tool produces a PDF: no server-side rendering
 * service, no extra dependency, real selectable text, and nothing leaves the
 * reader's machine.
 */
export function PrintTrigger() {
  return (
    <Button type="button" size="sm" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden="true" />
      Print or save as PDF
    </Button>
  );
}

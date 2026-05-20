export function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

export function safeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 1000) : fallback;
}

export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return safeText(raw, "Unable to display PDF.");
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function debounce(callback: () => void, delayMs: number): () => void {
  let handle = 0;
  return () => {
    window.clearTimeout(handle);
    handle = window.setTimeout(callback, delayMs);
  };
}

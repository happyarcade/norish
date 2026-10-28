export type GroceryToggleOutboxEntry = {
  id: string;
  groceryIds: string[];
  isDone: boolean;
  createdAt: number;
};

const STORAGE_KEY = "norish:grocery-toggle-outbox";

function isEntry(value: unknown): value is GroceryToggleOutboxEntry {
  if (!value || typeof value !== "object") return false;

  const entry = value as Partial<GroceryToggleOutboxEntry>;

  return (
    typeof entry.id === "string" &&
    Array.isArray(entry.groceryIds) &&
    entry.groceryIds.every((id) => typeof id === "string") &&
    typeof entry.isDone === "boolean" &&
    typeof entry.createdAt === "number"
  );
}

export function readGroceryToggleOutbox(storage: Storage = window.localStorage) {
  try {
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]") as unknown;

    return Array.isArray(stored) ? stored.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function writeGroceryToggleOutbox(
  entries: GroceryToggleOutboxEntry[],
  storage: Storage = window.localStorage
) {
  storage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function queueGroceryToggle(
  groceryIds: string[],
  isDone: boolean,
  storage: Storage = window.localStorage
) {
  const entry: GroceryToggleOutboxEntry = {
    id: crypto.randomUUID(),
    groceryIds,
    isDone,
    createdAt: Date.now(),
  };

  writeGroceryToggleOutbox([...readGroceryToggleOutbox(storage), entry], storage);

  return entry;
}

export function removeGroceryToggle(id: string, storage: Storage = window.localStorage): void {
  writeGroceryToggleOutbox(
    readGroceryToggleOutbox(storage).filter((entry) => entry.id !== id),
    storage
  );
}

export function shouldQueueGroceryToggle(error: unknown, isConnected: boolean): boolean {
  if (!isConnected || (typeof navigator !== "undefined" && navigator.onLine === false)) return true;

  const message = error instanceof Error ? error.message : String(error);

  return /failed to fetch|network|load failed|connection|websocket/i.test(message);
}

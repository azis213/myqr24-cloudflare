export interface WritableLike {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}

export interface FileHandleLike {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<WritableLike>;
  queryPermission?: (descriptor: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
}

interface PickerWindow {
  showOpenFilePicker?: (options?: unknown) => Promise<FileHandleLike[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<FileHandleLike>;
}

const pickerWindow = () => window as unknown as PickerWindow;

export function supportsFileSystemAccess(): boolean {
  return typeof pickerWindow().showOpenFilePicker === "function" && typeof pickerWindow().showSaveFilePicker === "function";
}

export function jsonFileTypes(description: string, extension: string) {
  return [{ description, accept: { "application/json": [extension] } }];
}

export async function ensurePermission(handle: FileHandleLike, mode: "read" | "readwrite"): Promise<boolean> {
  try {
    if (handle.queryPermission) {
      const state = await handle.queryPermission({ mode });
      if (state === "granted") return true;
    }
    if (handle.requestPermission) {
      return (await handle.requestPermission({ mode })) === "granted";
    }
    return true;
  } catch {
    return false;
  }
}

export async function readFromHandle(handle: FileHandleLike): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

export async function writeToHandle(handle: FileHandleLike, text: string): Promise<boolean> {
  if (!(await ensurePermission(handle, "readwrite"))) return false;
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
  return true;
}

export async function openTextFile(
  types: ReturnType<typeof jsonFileTypes>,
): Promise<{ handle: FileHandleLike; text: string } | null> {
  if (!supportsFileSystemAccess()) return null;
  const picker = pickerWindow().showOpenFilePicker;
  if (!picker) return null;
  const handles = await picker({ multiple: false, types, excludeAcceptAllOption: false });
  const handle = handles[0];
  if (!handle) return null;
  const text = await readFromHandle(handle);
  return { handle, text };
}

export async function saveAsTextFile(
  suggestedName: string,
  text: string,
  types: ReturnType<typeof jsonFileTypes>,
): Promise<FileHandleLike | null> {
  if (!supportsFileSystemAccess()) {
    downloadTextFile(suggestedName, text);
    return null;
  }
  const picker = pickerWindow().showSaveFilePicker;
  if (!picker) {
    downloadTextFile(suggestedName, text);
    return null;
  }
  const handle = await picker({ suggestedName, types });
  const written = await writeToHandle(handle, text);
  if (!written) throw new Error("Die Datei konnte nicht geschrieben werden (Berechtigung fehlt).");
  return handle;
}

const DB_NAME = "myqr24.tag-content-designer";
const STORE_NAME = "handles";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export type HandleKind = "template" | "library";

export async function rememberHandle(kind: HandleKind, handle: FileHandleLike, name: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ handle, name }, kind);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  } catch {
    /* Handle-Merken ist Komfort, kein Muss. */
  }
}

export async function recallHandle(kind: HandleKind): Promise<{ handle: FileHandleLike; name: string } | null> {
  try {
    const db = await openDatabase();
    const record = await new Promise<{ handle: FileHandleLike; name: string } | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(kind);
      request.onsuccess = () => resolve(request.result as { handle: FileHandleLike; name: string } | undefined);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return record ?? null;
  } catch {
    return null;
  }
}

export async function forgetHandle(kind: HandleKind): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(kind);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  } catch {
    /* ignorieren */
  }
}

export function downloadTextFile(name: string, text: string): void {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

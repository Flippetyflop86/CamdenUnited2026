export const DB_NAME = "CamdenUnitedDB";
export const STORE_NAME = "images";
const DB_VERSION = 1;

/**
 * Open the IndexedDB database.
 */
export const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
};

/**
 * Save an image (base64 string) to the database.
 * @param id The player ID
 * @param dataUrl The base64 image string
 */
export const saveImage = async (id: string, dataUrl: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(dataUrl, id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Retrieve an image from the database.
 * @param id The player ID
 * @returns The base64 image string, or undefined if not found.
 */
export const getImage = async (id: string): Promise<string | undefined> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Delete an image from the database.
 * @param id The player ID
 */
export const deleteImage = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

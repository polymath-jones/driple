"use client";

export function initCollection({
  dbName,
  objectStoreName,
  keyPath,
  indexes,
}: {
  dbName: string;
  objectStoreName: string;
  keyPath?: string;
  indexes?: {
    name: string;
    keyPath: string | Iterable<string>;
    unique?: boolean;
  }[];
}) {
  const request = indexedDB.open(dbName, 1);
  request.onupgradeneeded = (event) => {
    const db = (event?.target as IDBOpenDBRequest)?.result;
    const objectStore = db.createObjectStore(objectStoreName, {
      keyPath: keyPath ?? "_id",
      autoIncrement: false,
    });

    indexes?.forEach(({ name, keyPath: keyPaths, unique }) => {
      objectStore.createIndex(name, keyPaths, { unique });
    });
  };
}

export async function pushToCollection<T>(
  dbName: string,
  objectStoreName: string,
  data: T
) {
  const promise = new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onsuccess = async (event) => {
      const target = event?.target as IDBOpenDBRequest;
      const db = target.result;
      const transaction1 = db.transaction([objectStoreName], "readwrite");
      const objectStore = transaction1.objectStore(objectStoreName);

      objectStore.add(data);
      transaction1.oncomplete = () => {
        resolve();
      };
      transaction1.onerror = () => {
        reject();
      };
    };
  });
  return promise;
}
export async function findInCollection<T>(
  dbName: string,
  objectStoreName: string,
  key: string
) {
  const promise = new Promise<T>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = () => {
      reject("Failed to open database");
    };

    request.onsuccess = async (event) => {
      const target = event?.target as IDBOpenDBRequest;
      const db = target.result;
      const transaction2 = db.transaction([objectStoreName], "readonly");
      const objectStore2 = transaction2.objectStore(objectStoreName);
      const request = objectStore2.get(key);

      request.onsuccess = async () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject("Failed to get data");
      };
    };
  });
  return promise;
}

export function stringToHash(string: string) {
  var hash = 0,
    i,
    chr;
  if (string.length === 0) return hash.toString();
  for (i = 0; i < string.length; i++) {
    chr = string.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString();
}

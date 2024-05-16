"use client";

import {
  findInCollection,
  initCollection,
  pushToCollection,
  stringToHash,
} from "@/utils/db";
import { fetchRemoteComponent } from "@paciolan/remote-component";
import { createRequires } from "@paciolan/remote-module-loader";
import { useSignal, useSignalEffect } from "@preact/signals-react";
import axios from "axios";

// effect(() => console.log('Hello', name.value));
// const fullName = computed(() => `${name.value} is nothing`);
// effect(() => { const initialName = name.peek() + ": initial"; });
// const dd = useSignal(0);

const DB_NAME = "DRIPLE";
const OBJECT_STORE_NAME = "PLUGINS";

const dependencies = {
  react: require("react"),
};

export default function Home() {
  const Component = useSignal<JSX.Element | undefined>(undefined);

  useSignalEffect(() => {
    initCollection({
      dbName: DB_NAME,
      objectStoreName: OBJECT_STORE_NAME,
      keyPath: "id",
      indexes: [{ keyPath: "id", name: "id", unique: true }],
    });
    testIndexDbAndWasm();
    testRemoteComponent();
  });

  const testRemoteComponent = async () => {
    const url =
      "https://raw.githubusercontent.com/Paciolan/remote-component/master/examples/remote-components/HelloWorld.js";

    const fetchPlugin = async (url: string) => {
      const d = await findInCollection<any>(
        DB_NAME,
        OBJECT_STORE_NAME,
        stringToHash(url)
      );
      if (d) {
        console.log("Fetching plugin from db");
        return d.data;
      } else {
        const data = (await axios.get(url))?.data;
        if (data) {
          await pushToCollection(DB_NAME, OBJECT_STORE_NAME, {
            id: stringToHash(url),
            data,
          });
          return data;
        }
      }
    };
    const RemoteComponent = await fetchRemoteComponent({
      url,
      requires: createRequires(dependencies),
      fetcher: fetchPlugin,
    });

    const component = RemoteComponent({ url: "", name: "test" });
    Component.value = component;
  };

  const testIndexDbAndWasm = async () => {
    var mem: WebAssembly.Memory;
    let binary: Uint8Array = new Uint8Array(0);

    const importObject = {
      consoleLog: (arg: any) => {
        const buffer = new Uint8Array(mem.buffer);
        let nullIndex = -1;
        for (let i = arg; i < buffer.length; i++) {
          const currentElement = buffer[i];
          if (currentElement === 0) {
            nullIndex = i;
            break;
          }
        }
        const string = buffer.slice(arg, nullIndex);
        console.log(new TextDecoder().decode(string));
      },
      // memory: mem,
    };
    const url = "/plugins/test/zig-out/lib/audio_processor.wasm";

    const d = await findInCollection<{ id: string; data: Uint8Array }>(
      DB_NAME,
      OBJECT_STORE_NAME,
      stringToHash(url)
    );
    if (d) {
      console.log("Fetching plugin from db");
      binary = d.data;
    } else {
      const raw = await (await fetch(url))?.body?.getReader().read();
      const data = raw?.value;
      if (data) {
        await pushToCollection(DB_NAME, OBJECT_STORE_NAME, {
          id: stringToHash(url),
          data,
        });
        binary = data;
      }
    }

    const result = await WebAssembly.instantiate(binary, {
      env: importObject,
    });

    // console.log(audioCtx.sampleRate);

    const { getPointer, memory, testShared } = result.instance.exports as any;
    mem = memory;
    const startIndex = getPointer();
    const buffer = new Uint8Array(mem.buffer);
    buffer[startIndex] = 10;
    testShared();
  };

  return <main className=""> {Component} </main>;
}

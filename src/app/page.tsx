"use client";

import {
  findInCollection,
  initCollection,
  pushToCollection,
  stringToHash,
} from "@/utils/indexdb.utils";
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
const FILE_STORE_NAME = "FILES";
const wasm = "/plugins/gain/processor/zig-out/lib/processor.wasm";

let audioContext: AudioContext | null = null; // TO BE SIGNALS IN COMPONENT
let processorNode: AudioWorkletNode | null = null;
let gainNode: GainNode | null = null;
let soundSource: OscillatorNode | MediaElementAudioSourceNode | null = null;

const dependencies = {
  react: require("react"),
};

export default function Home() {
  const Component = useSignal<JSX.Element | undefined>(undefined);

  useSignalEffect(() => {
    initCollection({
      dbName: DB_NAME,
      objectStoreNames: [OBJECT_STORE_NAME, FILE_STORE_NAME],
      keyPath: "id",
      indexes: [{ keyPath: "id", name: "id", unique: true }],
    });
    testAudioProcessor();
    testRemoteComponent();
  });

  const getProcessorBinary = async () => {
    let binary: Uint8Array = new Uint8Array(0); // WASM BINARY FILE

    const d = await findInCollection<{ id: string; data: Uint8Array }>(
      DB_NAME,
      OBJECT_STORE_NAME,
      stringToHash(wasm)
    );
    if (d && false) {
      console.log("Fetching plugin from db");
      binary = d.data;
    } else {
      const raw = await (await fetch(wasm))?.body?.getReader().read();
      const data = raw?.value;
      if (data) {
        /*  await pushToCollection(DB_NAME, OBJECT_STORE_NAME, {
          id: stringToHash(wasm),
          data,
        }); */
        binary = data;
      }
    }

    return binary;
  };

  const testAudioProcessor = async () => {
    let url = "/plugins/gain/bridge.js";

    // FETCH PROCESSOR BRIDGE FROM DB OR SAVE TO DB
    /* const d = await findInCollection<{ id: string; data: Blob }>(
      DB_NAME,
      OBJECT_STORE_NAME,
      stringToHash(url)
    );

    if (d ) {
      console.log("Fetching processor from db");
      let reader = new FileReader();
      reader.readAsDataURL(d.data);
  
      url = await new Promise<any>((res) => {
          reader.onloadend = function () {
              res(reader.result);
          }
      }); 
    } else{
      const data = (await axios.get(url))?.data;
      let blob = new Blob([data], {type: 'application/javascript'});
      if (data) {
        console.log("Caching processor to db");
        try {
          await pushToCollection(DB_NAME, OBJECT_STORE_NAME, {
          id: stringToHash(url),
          data: blob,
        });
        } catch (error) {
          console.log(error)
        }
        
      }
    } */

    audioContext = new AudioContext();
    await audioContext.audioWorklet.addModule(url);

    try {
      processorNode = new AudioWorkletNode(audioContext, "test-generator", {
        processorOptions: {
          binary: await getProcessorBinary(),
        },
      });
      // console.log(Array.from(processorNode.parameters.values()));
    } catch (e) {
      console.log(`** Error: Unable to create worklet node: ${e}`);
      return null;
    }

    await audioContext.resume();
  };

  const startAudio = () => {
    if (audioContext && processorNode) {
      /* soundSource = new OscillatorNode(audioContext);
      soundSource.type = "square";
      soundSource.frequency.setValueAtTime(440, audioContext.currentTime); // (A4) */

      const audioElement = document.querySelector("audio");
      soundSource = audioContext.createMediaElementSource(audioElement!);

      audioElement?.addEventListener("ended", () => {
        audioElement.play();
        console.log("finished");
      });

      gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(0.6, audioContext.currentTime);

      processorNode.parameters
        .get("gain")
        ?.setValueAtTime(0.01, audioContext.currentTime);

      soundSource
        .connect(gainNode)
        .connect(processorNode)
        .connect(audioContext.destination);

      audioContext.resume();
      audioElement?.play();
    }
  };

  const stopAudio = () => {
    const audioElement = document.querySelector("audio");
    audioElement?.pause();
  };

  const testFileSystem = async () => {
    let entry = null;

    const d = await findInCollection<{
      id: string;
      data: any;
    }>(DB_NAME, FILE_STORE_NAME, "work_space");

    if (d) {
      entry = d.data
    } else {
      const fh: FileSystemDirectoryHandle = await (
        window as any
      ).showDirectoryPicker();
      if (fh) {
        await pushToCollection(DB_NAME, FILE_STORE_NAME, {
          id: "work_space",
          data: fh,
        });
        entry = fh;
      }
    }
    for await (const handle of entry.values()) {
      console.log(handle)
      if (handle.kind === "file") {
        const file = await handle.getFile();
        console.log(file);
      }
    }
  };

  const testRemoteComponent = async () => {
    const url = "https://raw.githubusercontent.com/Paciolan/remote-component/master/examples/remote-components/HelloWorld.js"; // prettier-ignore

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


  return (
    <main className="">
      {" "}
      {Component}
      <button onClick={startAudio}>click here</button>
      <br />
      <button onClick={stopAudio}>stop here</button>
      <audio src="anita.mp3"></audio>
      <br />
      <button onClick={testFileSystem}>Open dir</button>
    </main>
  );
}


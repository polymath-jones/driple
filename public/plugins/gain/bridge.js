class TestProcessor extends AudioWorkletProcessor {
  processSamples = null;
  memory = null;
  startPointer = null;
  counter = 0;
  bAllocate = null;
  fAllocate = null;
  parametersSize = null;
  deallocChannelBuffer = null;
  deallocParameterBuffer = null;
  freeAll = null;

  constructor(k) {
    super();
    this.init(k);
  }

  async init(k) {
    const { binary } = k.processorOptions;
    if (binary) {
      const importObject = {
        consoleLog: (arg) => {
          const buffer = new Uint8Array(this.memory.buffer);
          let nullIndex = -1;
          for (let i = arg; i < buffer.length; i++) {
            const currentElement = buffer[i];
            if (currentElement === 0) {
              nullIndex = i;
              break;
            }
          }
          const string = buffer.slice(arg, nullIndex);
          console.log(String.fromCharCode(...string));
        },
        getRand: () => Math.random(),
      };

      const result = await WebAssembly.instantiate(binary, {
        env: importObject,
      });

      const {
        memory,
        process,
        allocUint8,
        getParametersSize,
        allocF32,
        deallocChannel,
        deallocParameters,
        freeAll,
      } = result.instance.exports;

      this.parametersSize = Number.parseInt(getParametersSize());
      this.memory = memory;
      this.processSamples = process;
      this.bAllocate = allocUint8;
      this.fAllocate = allocF32;
      this.deallocChannelBuffer = deallocChannel;
      this.deallocParameterBuffer = deallocParameters;
      this.freeAll = freeAll;

      return;
    }
    throw "Binary not found";
  }

  static get parameterDescriptors() {
    return [
      {
        name: "gain",
        defaultValue: 0.2,
        minValue: 0,
        maxValue: 1,
      },
    ];
  }

  process(inputList, outputList, parameters) {
    const limit = Math.min(inputList.length, outputList.length);

    this.counter++;
    // if (this.counter === 10)
    for (let inputNum = 0; inputNum < limit; inputNum++) {
      const formattedParameters = Object.keys(parameters).reduce((obj, key) => {
        obj[key] = parameters[key][0];
        return obj;
      }, {});

      const parametersPointer = this.encodeObject(
        formattedParameters,
        this.bAllocate,
        this.parametersSize
      );

      const inputChannels = inputList[inputNum];
      const outputChannels = outputList[inputNum];

      const leftPointer = this.fAllocate(128);
      const rightPointer = this.fAllocate(128);

      const leftWindow = new Float32Array(this.memory.buffer, leftPointer, 128);
      leftWindow.set(inputChannels[0]);

      if (inputChannels.length === 2) {
        const rightWindow = new Float32Array(
          this.memory.buffer,
          rightPointer,
          128
        );
        rightWindow.set(inputChannels[1]);
      }

      const outputChannelsPointer = this.processSamples(
        leftPointer,
        rightPointer,
        parametersPointer
      );
      const channelPointers = new Uint32Array(
        this.memory.buffer,
        outputChannelsPointer,
        2
      );

      const leftOutSamples = new Float32Array(
        this.memory.buffer,
        channelPointers[0],
        128
      );
      const rightOutSamples = new Float32Array(
        this.memory.buffer,
        channelPointers[1],
        128
      );

      outputChannels[0].set(leftOutSamples);
      if (outputChannels.length === 2) {
        outputChannels[1].set(rightOutSamples);
      }
    }
    this.freeAll();
    /* if (this.counter === 3000) {
      console.log(this.memory);
      return false;
    } */

    return true;
  }

  encodeString(string, allocator) {
    const buffer = new TextEncoder().encode(string);
    const pointer = allocator(buffer.length + 1);
    const slice = new Uint8Array(
      this.memory.buffer,
      pointer,
      buffer.length + 1
    );
    slice.set(buffer);
    slice[buffer.length] = 0;
    return pointer;
  }

  encodeObject(object, allocator, maxSize = Number.MAX_SAFE_INTEGER) {
    const keys = Object.keys(object);
    const values = Object.values(object);
    const oneByte = 1;
    const fourBytes = oneByte * 4;

    let currentSize = 0;
    let offset = 0;

    // CALC SIZE AND VALIDATE PARAMETERS
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (
        typeof value === "number" ||
        typeof value === "string" ||
        typeof value === "object"
      )
        currentSize += fourBytes;
      else if (typeof value === "boolean") currentSize += oneByte;
      else throw { message: "Parameter type not supported", value };
    }

    // CHECK SIZE LIMIT
    if (currentSize > maxSize) throw "Parameter size exceeds limit";

    // ALLOCATE MEMORY AND WRITE PARAMETERS
    if (currentSize === 0) throw "Parameter is empty";
    else {
      const objectPointer = allocator(currentSize);

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = object[key];

        if (typeof value === "string") {
          const stringPointer = this.encodeString(value, allocator);
          const stringPointerSlice = new Uint32Array(
            this.memory.buffer,
            objectPointer + offset,
            1
          );
          stringPointerSlice[0] = stringPointer;
          offset += fourBytes;
        } else if (typeof value === "number") {
          let numberSlice = null;
          if (isFloat(value)) {
            numberSlice = new Float32Array(
              this.memory.buffer,
              objectPointer + offset,
              1
            );
          } else {
            numberSlice = new Int32Array(
              this.memory.buffer,
              objectPointer + offset,
              1
            );
          }

          numberSlice[0] = value;
          offset += fourBytes;
        } else if (typeof value === "boolean") {
          const buffer = new Uint8Array(this.memory.buffer);
          const string = buffer.slice(objectPointer + offset, 1);
          string[0] = value ? 1 : 0;
          offset += oneByte;
        } else if (typeof value === "object") {
          const objPointer = this.encodeObject(value, allocator);
          const objPointerSlice = new Uint32Array(
            this.memory.buffer,
            objectPointer + offset,
            1
          );
          objPointerSlice[0] = objPointer;
          offset += fourBytes;
        }
      }
      return objectPointer;
    }
  }
}

function TextEncoder() {}

TextEncoder.prototype.encode = function (string) {
  var octets = [];
  var length = string.length;
  var i = 0;
  while (i < length) {
    var codePoint = string.codePointAt(i);
    var c = 0;
    var bits = 0;
    if (codePoint <= 0x0000007f) {
      c = 0;
      bits = 0x00;
    } else if (codePoint <= 0x000007ff) {
      c = 6;
      bits = 0xc0;
    } else if (codePoint <= 0x0000ffff) {
      c = 12;
      bits = 0xe0;
    } else if (codePoint <= 0x001fffff) {
      c = 18;
      bits = 0xf0;
    }
    octets.push(bits | (codePoint >> c));
    c -= 6;
    while (c >= 0) {
      octets.push(0x80 | ((codePoint >> c) & 0x3f));
      c -= 6;
    }
    i += codePoint >= 0x10000 ? 2 : 1;
  }
  return octets;
};

function TextDecoder() {}

TextDecoder.prototype.decode = function (octets) {
  var string = "";
  var i = 0;
  while (i < octets.length) {
    var octet = octets[i];
    var bytesNeeded = 0;
    var codePoint = 0;
    if (octet <= 0x7f) {
      bytesNeeded = 0;
      codePoint = octet & 0xff;
    } else if (octet <= 0xdf) {
      bytesNeeded = 1;
      codePoint = octet & 0x1f;
    } else if (octet <= 0xef) {
      bytesNeeded = 2;
      codePoint = octet & 0x0f;
    } else if (octet <= 0xf4) {
      bytesNeeded = 3;
      codePoint = octet & 0x07;
    }
    if (octets.length - i - bytesNeeded > 0) {
      var k = 0;
      while (k < bytesNeeded) {
        octet = octets[i + k + 1];
        codePoint = (codePoint << 6) | (octet & 0x3f);
        k += 1;
      }
    } else {
      codePoint = 0xfffd;
      bytesNeeded = octets.length - i;
    }
    string += String.fromCodePoint(codePoint);
    i += bytesNeeded + 1;
  }
  return string;
};
function isInt(n) {
  return Number(n) === n && n % 1 === 0;
}

function isFloat(n) {
  return Number(n) === n && n % 1 !== 0;
}

registerProcessor("test-generator", TestProcessor);

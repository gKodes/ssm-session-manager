import { Duplex } from "node:stream";
import { deserializeFrame } from "./io";

// Custom Transform stream example (uppercase transformation)
class SMUX extends Duplex {
  constructor() {
    super({
      allowHalfOpen: true,
    });
  }

  _write(
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    if ((encoding && encoding !== "binary") || !(chunk instanceof Buffer)) {
      return callback(new Error("SMUX input stream is not binary or Buffer"));
    }

    const [frame, length] = deserializeFrame(chunk.buffer);
    this.push(frame);
  }

  _read(size: number): void {
    
  }
}

// const s = new SMUX();
// s.pipe()

class SMUXWeb extends TransformStream {}

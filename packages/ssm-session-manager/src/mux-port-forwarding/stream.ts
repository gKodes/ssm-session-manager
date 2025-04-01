import {
  FrameConfig,
  cmdPSH,
  cmdSYN,
  cmdFIN,
  DefaultFrameConfig,
  serializeFrame,
} from "@gkodes/smux";
import { SSMSession } from "../socket";
import { MessageType, PayloadType } from "../message";
import EventEmitter from "eventemitter3";

export function writeFrames(
  sid: number,
  connection: SSMSession,
  data: Uint8Array,
  config: FrameConfig = DefaultFrameConfig
) {
  for (let idx = 0; idx < data.byteLength; ) {
    const frameData = data.subarray(
      idx,
      (idx += Math.min(data.byteLength, config.MaxFrameSize))
    );

    connection.send({
      payload: serializeFrame({
        ver: config.Version,
        cmd: cmdPSH,
        sid,
        data: frameData,
      }),
      messageType: MessageType.InputStream,
      payloadType: PayloadType.Output,
    });
  }
}

export type StreamEvents = Record<"data" | "end" | "open", any[]>;

export class Stream extends EventEmitter<StreamEvents> {
  #sid: number;
  #config: FrameConfig;
  #session: SSMSession;

  constructor(
    sid: number,
    session: SSMSession,
    config: FrameConfig = DefaultFrameConfig
  ) {
    super();

    // Notify that we are opening a new stream
    session.send({
      payload: serializeFrame({
        ver: config.Version,
        cmd: cmdSYN,
        sid,
      }),
      payloadType: PayloadType.Output,
      messageType: MessageType.InputStream,
    });

    this.#sid = sid;
    this.#session = session;
    this.#config = config;
  }

  get sid(): number {
    return this.#sid;
  }

  write(data: Uint8Array | ArrayBuffer): void {
    // TODO: Error for closed lead
    writeFrames(
      this.#sid,
      this.#session,
      data instanceof Uint8Array ? data : new Uint8Array(data),
      this.#config
    );
  }

  end(): void {
    // Notify that we are ending the stream
    this.#session.send({
      payload: serializeFrame({
        ver: this.#config.Version,
        cmd: cmdFIN,
        sid: this.#sid,
      }),
      payloadType: PayloadType.Output,
      messageType: MessageType.InputStream,
    });
  }
}

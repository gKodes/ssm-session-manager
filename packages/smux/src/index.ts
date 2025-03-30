import { Frame, FrameConfig } from "./frame";
export * from "./io";
export * from "./protocol";

const SECOND_IN_MILLISECONDS = 1000;

export const KEEP_ALIVE_FRAME = new Uint8Array([1, 3, 0, 0, 0, 0, 0, 0]);

export const DefaultFrameConfig: FrameConfig = {
  Version: 1,
  KeepAliveInterval: 9 * SECOND_IN_MILLISECONDS,
  KeepAliveTimeout: 30 * SECOND_IN_MILLISECONDS,
  MaxFrameSize: 32768,
  MaxReceiveBuffer: 4194304,
  MaxStreamBuffer: 65536,
  KeepAliveDisabled: false,
};

export { Frame, FrameConfig };
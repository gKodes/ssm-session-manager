import { Frame } from "./frame";

export const sizeOfVer = 1;
export const sizeOfCmd = 1;
export const sizeOfLength = 2;
export const sizeOfSid = 4;
export const headerSize = sizeOfVer + sizeOfCmd + sizeOfSid + sizeOfLength;

export function deserializeFrame(
  buffer: ArrayBufferLike,
  byteOffset: number = 0
): [Frame, number] {
  const view = new DataView(buffer, byteOffset);
  let offset = 0;

  const ver = view.getInt8(offset);
  offset += sizeOfVer;
  const cmd = view.getInt8(offset);
  offset += sizeOfCmd;
  const length = view.getUint16(offset, true);
  offset += sizeOfLength;
  const sid = view.getUint32(offset, true);
  offset += sizeOfSid;
  const data = new Uint8Array(
    buffer,
    byteOffset + headerSize,
    Math.min(length, buffer.byteLength - headerSize - byteOffset)
  );

  return [
    {
      ver,
      cmd,
      sid,
      data,
    },
    length,
  ];
}

export function serializeFrame(
  frame: Omit<Frame, "data"> & { data?: Uint8Array }
): ArrayBuffer {
  const length = frame.data?.byteLength ?? 0;
  const buffer = new ArrayBuffer(headerSize + length);
  const view = new DataView(buffer);

  let offset = 0;

  view.setInt8(offset, frame.ver);
  offset += sizeOfVer;
  view.setInt8(offset, frame.cmd);
  offset += sizeOfCmd;
  view.setUint16(offset, length, true);
  offset += sizeOfLength;
  view.setUint32(offset, frame.sid, true);
  offset += sizeOfSid;
  if (frame.data) {
    new Uint8Array(buffer, offset, length).set(frame.data);
  }

  return buffer;
}

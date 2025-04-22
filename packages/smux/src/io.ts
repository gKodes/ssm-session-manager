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
  const view = new Uint8Array(buffer, byteOffset);
  let offset = 0;

  const ver = view[offset];
  offset += sizeOfVer;
  const cmd = view[offset];
  offset += sizeOfCmd;
  const length = view[offset] | (view[offset + 1] << 8);
  offset += sizeOfLength;
  const sid =
    view[offset] |
    (view[offset + 1] << 8) |
    (view[offset + 2] << 16) |
    (view[offset + 3] << 24);
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

export function isValidFrame(
  buffer: ArrayBufferLike,
  byteOffset: number = 0
): boolean {
  const view = new DataView(buffer, byteOffset);
  let offset = 0;

  const ver = view.getInt8(offset);
  offset += sizeOfVer;
  const cmd = view.getInt8(offset);

  return [1, 2].includes(ver) && [1, 2, 3, 4].includes(cmd);
}

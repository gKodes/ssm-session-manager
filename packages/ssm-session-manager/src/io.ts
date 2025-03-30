import { BinaryLike, createHash } from "node:crypto";
import {
  AcknowledgeContent,
  ChannelClosed,
  ClientMessage,
  ClientMessage_CreatedDateLength,
  ClientMessage_FlagsLength,
  ClientMessage_HLLength,
  ClientMessage_MessageIdLength,
  ClientMessage_MessageTypeLength,
  ClientMessage_PayloadDigestLength,
  ClientMessage_PayloadLengthLength,
  ClientMessage_PayloadLengthOffset,
  ClientMessage_PayloadTypeLength,
  ClientMessage_SchemaVersionLength,
  ClientMessage_SequenceNumberLength,
  MessageType,
  PayloadType,
} from "./message";
import { uuidStringify, uuidParse, uuidv4 } from "./uuid";

export type Message = Partial<
  Omit<ClientMessage, "payload" | "messageType" | "payloadType">
> &
  Pick<ClientMessage, "messageType" | "payloadType"> & {
    payload: ArrayBuffer | Uint8Array | string | any;
  };

export function calculateDigest(data: BinaryLike) {
  return createHash("sha256").update(data).digest();
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodeString(input: string | any) {
  return textEncoder.encode(
    typeof input === "string" ? input : JSON.stringify(input)
  );
}

export function decodeJSON(input: AllowSharedBufferSource) {
  return JSON.parse(textDecoder.decode(input));
}

export function deserializeClientMessage(
  buffer: ArrayBuffer,
  validateDigest: boolean = false
): ClientMessage {
  const view = new DataView(buffer);
  let offset = 0;

  const headerLength = view.getUint32(offset, false);
  offset += ClientMessage_HLLength;
  const messageType = textDecoder
    .decode(buffer.slice(offset, offset + 32))
    .trim()
    .replaceAll("\x00", "") as MessageType;
  offset += ClientMessage_MessageTypeLength;
  const schemaVersion = view.getUint32(offset, false);
  offset += ClientMessage_SchemaVersionLength;
  const createdDate = new Date(Number(view.getBigUint64(offset, false)));
  offset += ClientMessage_CreatedDateLength;
  const sequenceNumber = view.getBigInt64(offset, false);
  offset += ClientMessage_SequenceNumberLength;
  const flags = view.getBigUint64(offset, false);
  offset += ClientMessage_FlagsLength;
  const messageId = uuidStringify(
    new Uint8Array(buffer.slice(offset, offset + ClientMessage_MessageIdLength))
  );
  offset += ClientMessage_MessageIdLength;
  const payloadDigest = new Uint8Array(
    buffer.slice(offset, offset + ClientMessage_PayloadDigestLength)
  );
  offset += ClientMessage_PayloadDigestLength;
  const payloadType = view.getUint32(offset, false) as PayloadType;
  offset += ClientMessage_PayloadTypeLength;
  const payloadLength = view.getUint32(offset, false);
  offset += ClientMessage_PayloadLengthLength;
  const payload = new Uint8Array(buffer.slice(offset, offset + payloadLength));

  if (validateDigest) {
    const computedDigest = calculateDigest(payload);
    if (!Buffer.from(payloadDigest).equals(computedDigest)) {
      throw new Error("Payload digest validation failed");
    }
  }

  return {
    headerLength,
    messageType,
    schemaVersion,
    createdDate,
    sequenceNumber: Number(sequenceNumber),
    flags: Number(flags),
    messageId,
    payloadDigest,
    payloadType,
    payloadLength,
    payload,
  };
}

export function serializeClientMessage(
  message: Message
): [ArrayBuffer, string] {
  if (message.payload instanceof ArrayBuffer) {
    message.payload = new Uint8Array(message.payload);
  } else if (!(message.payload instanceof Uint8Array)) {
    message.payload = encodeString(message.payload);
  }

  const buffer = new ArrayBuffer(
    ClientMessage_PayloadLengthOffset +
      ClientMessage_PayloadLengthLength +
      message.payload.byteLength
  );
  const view = new DataView(buffer);
  let offset = 0;

  view.setUint32(
    offset,
    message.headerLength ?? ClientMessage_PayloadLengthOffset,
    false
  );
  offset += ClientMessage_HLLength;
  textEncoder.encodeInto(
    message.messageType.padStart(32, "\0"),
    new Uint8Array(buffer, offset, ClientMessage_MessageTypeLength)
  );
  offset += ClientMessage_MessageTypeLength;
  view.setUint32(offset, message.schemaVersion || 1, false);
  offset += ClientMessage_SchemaVersionLength;
  view.setBigUint64(
    offset,
    BigInt((message.createdDate ?? new Date()).getTime()),
    false
  );
  offset += ClientMessage_CreatedDateLength;
  view.setBigInt64(offset, BigInt(message.sequenceNumber ?? 0), false);
  offset += ClientMessage_SequenceNumberLength;
  view.setBigUint64(offset, BigInt(message.flags ?? 0), false);
  offset += ClientMessage_FlagsLength;
  if (!message.messageId) {
    message.messageId = uuidv4();
  }
  new Uint8Array(buffer, offset, ClientMessage_MessageIdLength).set(
    uuidParse(message.messageId)
  );
  offset += ClientMessage_MessageIdLength;

  if (!message.payloadDigest) {
    message.payloadDigest = calculateDigest(message.payload);
  }

  new Uint8Array(buffer, offset, ClientMessage_PayloadDigestLength).set(
    message.payloadDigest
  );
  offset += ClientMessage_PayloadDigestLength;
  view.setUint32(offset, message.payloadType, false);
  offset += ClientMessage_PayloadTypeLength;
  view.setUint32(offset, message.payload.byteLength, false);
  offset += ClientMessage_PayloadLengthLength;
  new Uint8Array(buffer, offset, message.payload.byteLength).set(
    message.payload
  );

  return [buffer, message.messageId];
}

export function isAcknowledgeContent(src: any): src is AcknowledgeContent {
  return "acknowledgedMessageType" in src && "acknowledgedMessageId" in src;
}

export function isChannelClosed(src: any): src is ChannelClosed {
  return "messageId" in src && "createdDate" in src;
}

export function isClientMessage(src: any): src is ClientMessage {
  return "headerLength" in src && "messageType" in src && "payload" in src;
}

export function isMessage(src: any): src is Message {
  return "messageType" in src && "payload" in src;
}

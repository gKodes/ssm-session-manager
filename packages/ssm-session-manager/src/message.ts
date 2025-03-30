export enum PayloadType {
  Unknown = 0,
  Output = 1,
  Error = 2,
  Size = 3,
  Parameter = 4,
  HandshakeRequestPayloadType = 5,
  HandshakeResponsePayloadType = 6,
  HandshakeCompletePayloadType = 7,
  EncChallengeRequest = 8,
  EncChallengeResponse = 9,
  Flag = 10,
  StdErr = 11,
  ExitCode = 12,
}

export enum PayloadTypeFlag {
  DisconnectToPort = 1,
  TerminateSession = 2,
  ConnectToPortError = 3,
}

export enum MessageType {
  InputStream = "input_stream_data",
  OutputStream = "output_stream_data",
  Acknowledge = "acknowledge",
  ChannelClosed = "channel_closed",
  StartPublication = "start_publication",
  PausePublication = "pause_publication",
}

export enum ActionType {
  KMSEncryption = "KMSEncryption",
  SessionType = "SessionType",
}

export enum ActionStatus {
  Success = 1,
  Failed = 2,
  Unsupported = 3,
}

export interface KMSEncryptionRequest {
  KMSKeyID: string;
}

export interface KMSEncryptionResponse {
  kmsCipherTextKey: Uint8Array;
  kmsCipherTextHash: Uint8Array;
}

export interface SessionTypeRequest {
  SessionType: string;
  Properties: any;
}

export interface HandshakeRequestPayload {
  AgentVersion: string;
  RequestedClientActions: RequestedClientAction[];
}

export interface RequestedClientAction {
  ActionType: ActionType;
  ActionParameters: any;
}

export interface ProcessedClientAction {
  ActionType: ActionType;
  ActionStatus: ActionStatus;
  ActionResult?: any;
  Error?: string;
}

export interface HandshakeResponsePayload {
  ClientVersion: string;
  ProcessedClientActions: ProcessedClientAction[];
  Errors?: string[];
}

export interface EncryptionChallengeRequest {
  Challenge: Uint8Array;
}

export interface EncryptionChallengeResponse {
  Challenge: Uint8Array;
}

export interface HandshakeCompletePayload {
  HandshakeTimeToComplete: number;
  CustomerMessage: string;
}

export interface AcknowledgeContent {
  AcknowledgedMessageType: string;
  AcknowledgedMessageId: string;
  AcknowledgedMessageSequenceNumber: number;
  IsSequentialMessage: boolean;
}

export interface ChannelClosed {
  MessageId: string;
  CreatedDate: string;
  DestinationId: string;
  SessionId: string;
  MessageType: MessageType;
  SchemaVersion: number;
  Output: string;
}

export interface SizeData {
  cols: number;
  rows: number;
}

export interface ClientMessage {
  headerLength: number;
  messageType: MessageType;
  schemaVersion: number;
  createdDate: Date;
  sequenceNumber: number;
  flags: number;
  messageId: string;
  payloadDigest: Uint8Array;
  payloadType: PayloadType;
  payloadLength: number;
  payload: Uint8Array;
}

// * HL - HeaderLength is a 4 byte integer that represents the header length.
// * MessageType is a 32 byte UTF-8 string containing the message type.
// * SchemaVersion is a 4 byte integer containing the message schema version number.
// * CreatedDate is an 8 byte integer containing the message create epoch millis in UTC.
// * SequenceNumber is an 8 byte integer containing the message sequence number for serialized message streams.
// * Flags is an 8 byte unsigned integer containing a packed array of control flags:
// *   Bit 0 is SYN - SYN is set (1) when the recipient should consider Seq to be the first message number in the stream
// *   Bit 1 is FIN - FIN is set (1) when this message is the final message in the sequence.
// * MessageId is a 40 byte UTF-8 string containing a random UUID identifying this message.
// * Payload digest is a 32 byte containing the SHA-256 hash of the payload.
// * Payload length is an 4 byte unsigned integer containing the byte length of data in the Payload field.
// * Payload is a variable length byte data.
//
// * | HL|         MessageType           |Ver|  CD   |  Seq  | Flags |
// * |         MessageId                     |           Digest              | PayType | PayLen|
// * |         Payload      			|

export const ClientMessage_HLLength = 4;
export const ClientMessage_MessageTypeLength = 32;
export const ClientMessage_SchemaVersionLength = 4;
export const ClientMessage_CreatedDateLength = 8;
export const ClientMessage_SequenceNumberLength = 8;
export const ClientMessage_FlagsLength = 8;
export const ClientMessage_MessageIdLength = 16;
export const ClientMessage_PayloadDigestLength = 32;
export const ClientMessage_PayloadTypeLength = 4;
export const ClientMessage_PayloadLengthLength = 4;

export const ClientMessage_HLOffset = 0;
export const ClientMessage_MessageTypeOffset =
  ClientMessage_HLOffset + ClientMessage_HLLength;
export const ClientMessage_SchemaVersionOffset =
  ClientMessage_MessageTypeOffset + ClientMessage_MessageTypeLength;
export const ClientMessage_CreatedDateOffset =
  ClientMessage_SchemaVersionOffset + ClientMessage_SchemaVersionLength;
export const ClientMessage_SequenceNumberOffset =
  ClientMessage_CreatedDateOffset + ClientMessage_CreatedDateLength;
export const ClientMessage_FlagsOffset =
  ClientMessage_SequenceNumberOffset + ClientMessage_SequenceNumberLength;
export const ClientMessage_MessageIdOffset =
  ClientMessage_FlagsOffset + ClientMessage_FlagsLength;
export const ClientMessage_PayloadDigestOffset =
  ClientMessage_MessageIdOffset + ClientMessage_MessageIdLength;
export const ClientMessage_PayloadTypeOffset =
  ClientMessage_PayloadDigestOffset + ClientMessage_PayloadDigestLength;
export const ClientMessage_PayloadLengthOffset =
  ClientMessage_PayloadTypeOffset + ClientMessage_PayloadTypeLength;
export const ClientMessage_PayloadOffset =
  ClientMessage_PayloadLengthOffset + ClientMessage_PayloadLengthLength;

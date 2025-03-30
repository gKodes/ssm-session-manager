import { EventEmitter } from "eventemitter3";
import {
  AcknowledgeContent,
  ClientMessage,
  MessageType,
  PayloadType,
} from "./message";
import { StartSessionCommandOutput } from "@aws-sdk/client-ssm";
import { uuidv4 } from "./uuid";
import {
  decodeJSON,
  isMessage,
  Message,
  deserializeClientMessage,
  serializeClientMessage,
} from "./io";

function startPings(connection: WebSocketLike, sessionId?: string) {
  if (connection.readyState !== WebSocket.OPEN) {
    return;
  }

  connection.ping!("keepalive");
  console.info(`Send ping. Message. for ${sessionId}`);
  setTimeout(startPings.bind(null, connection, sessionId), 5 * 60000); // 5 min
}

interface WebSocketLike {
  url: string;
  readyState: number;
  onopen: ((event: any) => void) | null;
  onmessage: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onclose: ((event: any) => void) | null;
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  ping?: (event: any) => void;
  binaryType: string;
  protocol: string;
  extensions: string;
}

export interface ClientMessageSocketOptions {
  autoAcknowledge: boolean;
}

export type SSMSessionEvents = Record<MessageType, any[]>;

export class SSMSession extends EventEmitter<SSMSessionEvents> {
  #upstreamSocket: WebSocketLike;
  #upstreamSequenceNumber: number = 0;
  #downStreamSequenceNumber: number = 0;
  #options?: ClientMessageSocketOptions;
  #session: StartSessionCommandOutput;

  constructor(
    session: StartSessionCommandOutput,
    socket: WebSocketLike,
    options?: ClientMessageSocketOptions
  ) {
    super();
    this.#options = options;
    this.#session = session;
    this.#upstreamSocket = socket;
    this.#upstreamSocket.binaryType = "arraybuffer";

    this.#upstreamSocket.onopen = () => {
      if (socket.ping) {
        startPings(socket, session.SessionId);
      }
    };

    this.#upstreamSocket.onerror = (error) => {
      console.log(`WebSocket error: ${error}`);
    };

    this.#upstreamSocket.onmessage = (event) => {
      const { data } = event;
      if (!(data instanceof ArrayBuffer)) {
        console.warn("not an binary message");
      }

      const message = deserializeClientMessage(data as ArrayBuffer);

      console.info(
        `Processing stream data message of type: ${message.messageType}`
      );

      if (message.messageType !== MessageType.Acknowledge) {
        if (this.#downStreamSequenceNumber !== message.sequenceNumber) {
          console.info(
            `Unexpected sequence message received. Received Sequence Number: ${
              message.sequenceNumber
            }. Expected Sequence Number: ${this.#downStreamSequenceNumber}`
          );

          if (message.messageType === MessageType.ChannelClosed) {
            this.emit(message.messageType, message);
          }

          return;
        }

        this.#downStreamSequenceNumber++;

        if (this.#options?.autoAcknowledge) {
          this.sendAcknowledge(message);
        }
      }

      if (message.messageType === MessageType.Acknowledge) {
        const acknowlageContent = decodeJSON(
          message.payload
        ) as AcknowledgeContent;
        console.info(
          `received acknowledgement for ${acknowlageContent.AcknowledgedMessageId} : ${acknowlageContent.AcknowledgedMessageSequenceNumber}`
        );
      }

      this.emit(message.messageType, message);
    };
  }

  get readyState(): number {
    return this.#upstreamSocket.readyState;
  }

  startSession(): void {
    this.#upstreamSocket.send(
      JSON.stringify({
        MessageSchemaVersion: "1.0",
        RequestId: uuidv4(),
        TokenValue: this.#session.TokenValue,
      })
    );
  }

  send(message: Message | Parameters<WebSocketLike["send"]>[0]): string | void {
    if (isMessage(message)) {
      if (typeof message.sequenceNumber === "undefined") {
        message.sequenceNumber = this.#upstreamSequenceNumber++;
      }

      const [data, messageId] = serializeClientMessage(message);

      this.#upstreamSocket.send(data);

      if (message.messageType !== MessageType.Acknowledge) {
        console.info(
          `Sending message with seq number: ${message.sequenceNumber}`
        );
      }

      return messageId;
    }

    return this.#upstreamSocket.send(message);
  }

  sendAcknowledge(message: ClientMessage): string {
    const acknowledgeContent: AcknowledgeContent = {
      AcknowledgedMessageId: message.messageId,
      AcknowledgedMessageSequenceNumber: message.sequenceNumber,
      AcknowledgedMessageType: message.messageType,
      IsSequentialMessage: true, // TODO: come back and revie this
    };

    const [data, messageId] = serializeClientMessage({
      messageType: MessageType.Acknowledge,
      payloadType: PayloadType.Unknown,
      payload: acknowledgeContent,
    });

    this.#upstreamSocket.send(data);
    return messageId;
  }
}

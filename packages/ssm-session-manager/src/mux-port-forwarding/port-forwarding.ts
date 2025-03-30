import { cmdNOP, cmdFIN, cmdSYN, deserializeFrame, Frame } from "@gkodes/smux";
import {
  ActionStatus,
  ClientMessage,
  HandshakeCompletePayload,
  HandshakeRequestPayload,
  HandshakeResponsePayload,
  MessageType,
  PayloadType,
} from "../message";
import { SSMSession } from "../socket";
import { Stream } from "./stream";
import { decodeJSON, isClientMessage } from "../io";
import { headerSize } from "@gkodes/smux";
import EventEmitter from "eventemitter3";

export class StreamBuffer {
  #buffer?: Uint8Array;
  #consumed: number;
  sid: number;
  lastSequenceNumber: number;

  constructor(sid: number, length: number, lastSequenceNumber: number) {
    this.sid = sid;
    this.lastSequenceNumber = lastSequenceNumber;
    this.#buffer = new Uint8Array(length);
    this.#consumed = 0;
  }

  get length(): number {
    return this.#buffer?.byteLength ?? 0;
  }

  canConsume(): boolean {
    return this.length === this.#consumed;
  }

  write(source: Uint8Array, lastSequenceNumber: number): number {
    const data = source.slice(0, this.length - this.#consumed);
    this.#buffer?.set(data, this.#consumed);
    this.#consumed += data.byteLength;
    this.lastSequenceNumber = lastSequenceNumber;

    return data.byteLength;
  }

  consume(): Uint8Array {
    const data = this.#buffer!;
    this.#buffer = undefined;

    return data;
  }
}

export type PortForwardingEvents = Record<"ready", any[]>;

export class PortForwarding extends EventEmitter<PortForwardingEvents>  {
  #session: SSMSession;
  #nextStreamID: number = 1;
  #streams: Record<number, Stream> = {};
  #buffer?: StreamBuffer;

  constructor(session: SSMSession) {
    super();
    this.#session = session;

    session.on(MessageType.OutputStream, this.#outputMessageHandler, this);
  }

  #outputMessageHandler(message: ClientMessage) {
    switch (message.payloadType) {
      case PayloadType.HandshakeRequestPayloadType:
        console.debug("Processing HandshakeRequest message");

        const handshakeRequest: HandshakeRequestPayload = decodeJSON(
          message.payload
        );

        const handshakeResponse: HandshakeResponsePayload = {
          ClientVersion: "1.2.707.0", // "1.2.339.0", // "ts-0.0.1.0", "1.2.0.0"
          ProcessedClientActions: [],
        };

        for (let action of handshakeRequest.RequestedClientActions) {
          handshakeResponse.ProcessedClientActions.push({
            ActionType: action.ActionType,
            ActionStatus: ActionStatus.Success,
          });
        }

        this.#session.send({
          payload: handshakeResponse,
          messageType: MessageType.InputStream,
          payloadType: PayloadType.HandshakeResponsePayloadType,
        });
        break;
      case PayloadType.HandshakeCompletePayloadType:
        this.#session.removeListener(
          MessageType.OutputStream,
          this.#outputMessageHandler,
          this
        );

        this.#session.addListener(
          MessageType.OutputStream,
          this.#processStreamMessagePayload,
          this
        );

        const handshakeComplete: HandshakeCompletePayload = decodeJSON(
          message.payload
        );

        console.debug(
          `Handshake Complete. Handshake time to complete is: ${handshakeComplete.HandshakeTimeToComplete} seconds`
        );

        this.emit("ready");
        break;
    }
  }

  #processStreamMessagePayload(message: ClientMessage) {
    console.info(
      `Process new incoming stream data message. Sequence Number: ${message.sequenceNumber}`
    );
    if (message.payloadType !== PayloadType.Output) {
      console.warn(`Invalid message ${message.payloadType}`);
      return;
    }

    const { payload, payloadLength, sequenceNumber } = message;

    for (let pdx = 0; pdx < payloadLength; ) {
      // TODO: Not sure how sequence no. would work, may need to hand it??
      if (this.#buffer) {
        pdx += this.#buffer.write(payload, sequenceNumber);

        if (this.#buffer.canConsume()) {
          const data = this.#buffer.consume();
          this.#streams[this.#buffer.sid].emit("data", data);
          console.info(
            `Received payload of size ${data.byteLength} from datachannel.`
          );
          this.#buffer = undefined;
        }
        continue;
      }

      const frameData = payload.slice(pdx);
      const [frame, lenght] = deserializeFrame(frameData.buffer);
      pdx += lenght + headerSize;

      switch (frame.cmd) {
        case cmdNOP:
        case cmdSYN:
          // Respond with Pong Message for the Ping
          this.#session.send({
            payload: message.payload,
            messageType: MessageType.InputStream,
            payloadType: PayloadType.Output,
          });
          break;
        case cmdFIN:
          // Stream has ended find the end event and delete it
          this.#streams[frame.sid].emit("end");
          delete this.#streams[frame.sid];
          break;
        default:
          if (lenght + headerSize === payloadLength) {
            console.info(
              `Received payload of size ${lenght} from datachannel.`
            );
            this.#streams[frame.sid].emit("data", frame.data);
            return;
          }

          (this.#buffer = new StreamBuffer(
            frame.sid,
            lenght,
            sequenceNumber
          )).write(frame.data, sequenceNumber);
      }
    }
  }

  newStream(): Stream {
    const stream = (this.#streams[this.#nextStreamID] = new Stream(
      this.#nextStreamID,
      this.#session
    ));

    this.#nextStreamID += 2;

    return stream;
  }
}

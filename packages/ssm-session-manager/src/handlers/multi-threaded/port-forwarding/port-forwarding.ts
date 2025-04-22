import { cmdNOP, cmdFIN, cmdSYN, deserializeFrame } from "@gkodes/smux";
import {
  ActionStatus,
  ClientMessage,
  HandshakeCompletePayload,
  HandshakeRequestPayload,
  HandshakeResponsePayload,
  MessageType,
  PayloadType,
} from "../../../message";
import { SSMSession } from "../../../socket";
import { Stream } from "./stream";
import { decodeJSON } from "../../../io";
import { headerSize } from "@gkodes/smux";

export class StreamBuffer {
  #buffer?: Uint8Array[];
  #length: number;
  #consumed: number;
  sid?: number;
  lastSequenceNumber: number;

  constructor(length: number, lastSequenceNumber: number, sid?: number) {
    this.sid = sid;
    this.lastSequenceNumber = lastSequenceNumber;
    this.#length = length;
    this.#buffer = []; //new Uint8Array(length);
    this.#consumed = 0;
  }

  get length(): number {
    return this.#length;
  }

  get consumed(): number {
    return this.#consumed;
  }

  canConsume(): boolean {
    return this.#length === this.#consumed;
  }

  write(source: Uint8Array, lastSequenceNumber: number): number {
    const data = source.subarray(0, this.length - this.#consumed);
    this.#buffer?.push(data);
    this.#consumed += data.byteLength;
    this.lastSequenceNumber = lastSequenceNumber;

    return data.byteLength;
  }

  consume(): Uint8Array[] {
    const data = this.#buffer!;
    this.#buffer = undefined;

    return data;
  }
}

export type PortForwardingEvents = Record<"ready", any[]>;

export class PortForwarding {
  #session: SSMSession;
  #nextStreamID: number = 1;
  #streams: Record<number, Stream> = {};
  #buffer?: StreamBuffer;
  #rawBuffer?: Uint8Array;
  #handShakeCompleted: boolean = false;
  clientVersion: string;

  onready?: () => void;

  constructor(session: SSMSession, clientVersion: string = "1.2.707.0") {
    this.#session = session;
    this.clientVersion = clientVersion;
  }

  get isHandShakeCompeleted(): boolean {
    return this.#handShakeCompleted;
  }

  outputMessageHandler(message: ClientMessage) {
    switch (message.payloadType) {
      case PayloadType.HandshakeRequestPayloadType:
        console.debug("Processing HandshakeRequest message");

        const handshakeRequest: HandshakeRequestPayload = decodeJSON(
          message.payload
        );

        const handshakeResponse: HandshakeResponsePayload = {
          ClientVersion: this.clientVersion,
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
        this.#handShakeCompleted = true;
        const handshakeComplete: HandshakeCompletePayload = decodeJSON(
          message.payload
        );

        console.debug(
          `Handshake Complete. Handshake time to complete is: ${handshakeComplete.HandshakeTimeToComplete} seconds`
        );

        this.onready?.();
        break;
    }
  }

  processStreamMessagePayload(message: ClientMessage) {
    console.info(
      `Process new incoming stream data message. Sequence Number: ${message.sequenceNumber} | ${message.payloadLength}`
    );
    if (message.payloadType !== PayloadType.Output) {
      console.warn(`Invalid message ${message.payloadType}`);
      return;
    }

    const { sequenceNumber } = message;
    let { payload, payloadLength } = message;

    if (this.#rawBuffer) {
      // TODO: Make this also into an array
      var mergedPayload = new Uint8Array(
        payloadLength + this.#rawBuffer.length
      );
      mergedPayload.set(this.#rawBuffer);
      mergedPayload.set(payload, this.#rawBuffer.length);

      payload = mergedPayload;
      payloadLength = mergedPayload.byteLength;
      this.#rawBuffer = undefined;
    }

    for (let pdx = 0; pdx < payloadLength; ) {
      // TODO: Not sure how sequence no. would work, may need to hand it??
      if (this.#buffer) {
        pdx += this.#buffer.write(payload, sequenceNumber);

        if (this.#buffer.canConsume()) {
          const data = this.#buffer.consume();
          this.#streams[this.#buffer.sid!].emit("data", data);
          console.info(
            `Received payload of size ${this.#buffer.consumed} from datachannel. For stream ${this.#buffer.sid}`
          );
          this.#buffer = undefined;
        }
        continue;
      }

      const frameData = payload.subarray(pdx);
      if (frameData.byteLength < 8) {
        // NOTE: don't have enought data to parse frame
        this.#rawBuffer = frameData;
        return;
      }

      const [frame, lenght] = deserializeFrame(
        frameData.buffer,
        frameData.byteOffset
      );
      // console.info(frame, 'of length', lenght);
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
          if (frame.data.byteLength === lenght) {
            console.info(
              `Received payload of size ${lenght} from datachannel. For stream ${frame.sid}`
            );
            this.#streams[frame.sid].emit("data", [frame.data]);
            continue;
          }

          (this.#buffer = new StreamBuffer(
            lenght,
            sequenceNumber,
            frame.sid
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

import { Frame } from "@gkodes/smux";
import { ClientMessage, MessageType } from "../../message";

export enum WorkerMessageType {
  Acknowledge = "acknowledge",
  ClientMessage = "clientMessage",
  Frame = "frame",
}

export interface WorkerMessageAcknowledge {
  type: WorkerMessageType.Acknowledge;
  data: {
    messageId: string;
    sequenceNumber: number;
    messageType: MessageType;
  }
}

export interface WorkerMessageClientMessage {
  type: WorkerMessageType.ClientMessage;
  data: ClientMessage
}

export interface WorkerMessageFrame {
  type: WorkerMessageType.Frame;
  sequenceNumber: number;
  data: Frame
}

export type WorkerMessage = WorkerMessageAcknowledge | WorkerMessageClientMessage | WorkerMessageFrame;

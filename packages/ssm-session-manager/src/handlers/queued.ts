import Queue from "queue";
import { SSMSession } from "../socket";
import { deserializeClientMessage } from "../io";
import { MessageType } from "../message";

export function queuedMessageHandler(ssmSession: SSMSession) {
  let downStreamSequenceNumber: number = 0;
  let incommingMessages: Queue = new Queue({ autostart: true, concurrency: 1 });

  (ssmSession as any).incommingMessages = incommingMessages;

  return function queuedMessage(event: any) {
    const { data } = event;
    if (!(data instanceof ArrayBuffer)) {
      console.warn("not an binary message");
    }

    const message = deserializeClientMessage(data as ArrayBuffer);

    console.info(
      `Processing stream data message of type: ${message.messageType}`
    );

    if (message.messageType !== MessageType.Acknowledge) {
      if (downStreamSequenceNumber !== message.sequenceNumber) {
        console.info(
          `Unexpected sequence message received. Received Sequence Number: ${
            message.sequenceNumber
          }. Expected Sequence Number: ${downStreamSequenceNumber}`
        );

        if (message.messageType === MessageType.ChannelClosed) {
          ssmSession.emit(message.messageType, message);
        }

        return;
      }

      downStreamSequenceNumber++;
      ssmSession.sendAcknowledge(message);
    }

    // NOTE: this is to handle back prussere
    incommingMessages.push(async (next) => {
      ssmSession.emit(message.messageType, message);
      next!();
    });
  };
}

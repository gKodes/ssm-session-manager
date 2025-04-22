import { ClientMessage, MessageType } from "../../../message";
import { SSMSession } from "../../../socket";
import { MultiThreadedClientMessageDeserializer, OnMessageHandler } from "../io";
import { PortForwarding } from "./port-forwarding";

export function portForawrdMessageHandler(
  ssmSession: SSMSession,
  workerSrc: string | URL
) : [PortForwarding, OnMessageHandler] {
  let downStreamSequenceNumber: number = 0;
  let worker = new MultiThreadedClientMessageDeserializer(ssmSession, {
    maxWrokers: 4,
    workerSrc,
  });
  let buffer = new Map<ClientMessage["sequenceNumber"], ClientMessage>();
  const forwarder = new PortForwarding(ssmSession);

  (ssmSession as any).worker = worker;

  worker.onMessage = (message: ClientMessage) => {
    console.info(
      `Processing stream data message of type: ${message.messageType} | ${message.sequenceNumber}`
    );

    if (message.messageType === MessageType.Acknowledge) {
      return;
    }

    if (downStreamSequenceNumber !== message.sequenceNumber) {
      if (message.sequenceNumber > downStreamSequenceNumber) {
        buffer.set(message.sequenceNumber, message);
      }

      console.info(
        `Unexpected sequence message received. Received Sequence Number: ${
          message.sequenceNumber
        }. Expected Sequence Number: ${downStreamSequenceNumber}`
      );

      return;
    }

    if (message.messageType !== MessageType.OutputStream) {
      return;
    }

    do {
      if (forwarder.isHandShakeCompeleted) {
        forwarder.processStreamMessagePayload(message);
      } else {
        forwarder.outputMessageHandler(message);
      }

      downStreamSequenceNumber++;
      // console.info(
      //   `Has next message in q ${buffer.has(downStreamSequenceNumber)} | ${downStreamSequenceNumber}`
      // );
    } while (
      (message = buffer.get(downStreamSequenceNumber)!) &&
      buffer.delete(downStreamSequenceNumber)
    );
  };

  return [
    forwarder,
    function workerMessage(event: any) {
      const { data } = event;
      if (!(data instanceof ArrayBuffer)) {
        console.warn("not an binary message");
      }

      worker.postMessage(data as ArrayBuffer);
    },
  ];
}

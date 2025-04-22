import { parentPort } from "node:worker_threads";
import { deserializeClientMessage } from "../../../io";

if (!parentPort) throw new Error("No parent port!");

parentPort.on("message", (data: ArrayBuffer) => {
  const clientMessage = deserializeClientMessage(data as ArrayBuffer);
  //TODO: See if we can ack from here to improve performance
  parentPort!.postMessage(clientMessage, [clientMessage.payload.buffer]);
});

// server.js
import { Worker } from "node:worker_threads";
import { pathToFileURL } from "node:url";
import { ClientMessage } from "../../message";
import { SSMSession } from "../../socket";

export type OnMessageHandler = (message: ClientMessage) => void;

export interface MultiThreadedClientMessageDeserializerOptions {
  onMessage?: OnMessageHandler;
  maxWrokers: number;
  workerSrc: string | URL;
}

export class MultiThreadedClientMessageDeserializer {
  #messageQueue: ArrayBuffer[] = [];
  #availableWorkers: Worker[] = [];
  #ssmSession: SSMSession;
  #workerSrc: string | URL;

  onMessage?: OnMessageHandler = undefined;

  constructor(
    ssmSession: SSMSession,
    {
      onMessage,
      maxWrokers,
      workerSrc,
    }: MultiThreadedClientMessageDeserializerOptions
  ) {
    this.onMessage = onMessage;
    this.#ssmSession = ssmSession;
    this.#workerSrc = workerSrc;

    for (let wpi = 0; wpi < maxWrokers; wpi++) {
      this.#availableWorkers.push(this.#createWorker());
    }
  }

  #createWorker() {
    const worker = new Worker(this.#workerSrc);

    worker.on("message", (message: ClientMessage) => {
      this.#ssmSession.sendAcknowledge(message);

      this.onMessage?.(message);
      const nextMessage = this.#messageQueue.pop();

      if (nextMessage) {
        worker.postMessage(nextMessage, [nextMessage]);
        return;
      }

      this.#availableWorkers.push(worker);
    });

    return worker;
  }

  postMessage(message: ArrayBuffer) {
    const availableWorker = this.#availableWorkers.pop();

    if (!availableWorker) {
      this.#messageQueue.push(message);
      return;
    }

    availableWorker.postMessage(message, [message]);
  }
}

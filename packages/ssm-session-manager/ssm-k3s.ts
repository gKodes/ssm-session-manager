import { WebSocket } from "ws";
import {
  SSMClient,
  StartSessionCommand,
  StartSessionCommandOutput,
  TerminateSessionCommand,
} from "@aws-sdk/client-ssm";
import * as net from "node:net";
import { Writable } from "node:stream";

import {
  SSMSession,
  PortForwarding,
  MessageType,
} from "./src";

export type PortForwardingParameters = Record<
  "portNumber" | "localPortNumber" | "host",
  string[]
>;

export class SSMConnection {
  #client: SSMClient;
  #session: StartSessionCommandOutput;
  #socket: WebSocket;
  #listner: net.Server;

  constructor(
    client: SSMClient,
    session: StartSessionCommandOutput,
    socket: WebSocket,
    listner: net.Server
  ) {
    this.#client = client;
    this.#session = session;
    this.#socket = socket;
    this.#listner = listner;
  }

  async end() {
    this.#listner.close();
    this.#socket.close();

    await this.#client.send(
      new TerminateSessionCommand({
        SessionId: this.#session.SessionId,
      })
    );
  }

  static async createConnection(
    instanceId: string,
    parameters: PortForwardingParameters,
    region: string = "ap-south-1"
  ): Promise<SSMConnection> {
    const client = new SSMClient({ region });

    // Start the SSM session
    const startSessionCommand = new StartSessionCommand({
      Target: instanceId,
      Parameters: parameters,
      DocumentName: "AWS-StartPortForwardingSessionToRemoteHost",
    });

    const session = await client.send(startSessionCommand);
    const webSocket = new WebSocket(session.StreamUrl!);
    const ssmSession = new SSMSession(session, webSocket, {
      autoAcknowledge: true,
    });

    const portForwarding = new PortForwarding(ssmSession);
    webSocket.addEventListener("open", () => ssmSession.startSession(), {
      once: true,
    });

    const server = net.createServer(
      { allowHalfOpen: true, noDelay: true },
      (socket) => {
        const stream = portForwarding.newStream();
        socket.setNoDelay(true);
        // console.info(`Client stream opened ${stream.sid}`);

        socket.pipe(
          new Writable({
            write(data, _, callback) {
              // console.info(
              //   `Received message of size ${data.length} from mux client.`
              // );

              stream.write(data);
              callback();
            },
            final(callback) {
              stream.end();
              callback();
            },
          })
        );

        stream.on("data", (segments: Uint8Array[]) => {
          for (let data of segments) {
            socket.write(data);
          }
        });

        stream.on("end", () => {
          socket.end();
        });

        ssmSession.once(MessageType.ChannelClosed, () => {
          socket.destroySoon();
        });

        server.once("close", () => {
          socket.destroySoon();
        });

        socket.on("error", (err) => {
          console.error(`Socket error: ${err}`);
        });
      }
    );

    ssmSession.once(MessageType.ChannelClosed, () => {
      webSocket.terminate();
      if (server.listening) {
        server.close();
      }
    });

    webSocket.addEventListener(
      "close",
      () => {
        if (server.listening) {
          server.close();
        }
      },
      { once: true }
    );

    return new Promise<SSMConnection>((resolve, reject) => {
      portForwarding.once("ready", () => {
        server.listen(6443);
        resolve(new SSMConnection(client, session, webSocket, server));
      });
    });
  }
}

// Replace with actual EC2 Instance Id
// const session = await createSession("i-0e2128a9fb83f7ad8");
const ssmConnection = await SSMConnection.createConnection(
  "i-095ad75ceaef8d386",
  { portNumber: ["6443"], localPortNumber: ["6443"], host: ["10.30.41.121"] }
);

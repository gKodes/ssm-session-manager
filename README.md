# ssm-session-manager

A TypeScript/JavaScript library designed to simplify establishing and managing AWS SSM Session data. It also provides utilities for handling smux (v1) frames, offering seamless multiplexed data management over a single connection. Ideal for building efficient port-forwarding solutions and managing AWS SSM connections programmatically.

## Port Forwarding

```typescript
import { onExit } from "signal-exit";
import { WebSocket } from "ws";
import { SSMClient, StartSessionCommand, TerminateSessionCommand } from "@aws-sdk/client-ssm";
import * as net from "node:net";
import { Writable } from "node:stream";

import { SSMSession, PortForwarding, MessageType } from "@gkodes/ssm-session-manager";

async function createSession(
  instanceId: string,
  region: string = "ap-south-1"
) {
  const client = new SSMClient({ region });

  const Parameters = {
    portNumber: ["80"],
    localPortNumber: ["8080"],
    // Host port onto which you want to connect only needed for AWS-StartPortForwardingSessionToRemoteHost
    host: ["10.xx.xx.xx"],
  };

  // Start the SSM session
  const startSessionCommand = new StartSessionCommand({
    Target: instanceId,
    Parameters,
    //DocumentName: "AWS-StartPortForwardingSession"
    DocumentName: "AWS-StartPortForwardingSessionToRemoteHost",
  });

  const session = await client.send(startSessionCommand);

  console.info(`Starting session with SessionId: ${session.SessionId}`);

  onExit((code, signal) => {
    (async () => {
      await client.send(
        new TerminateSessionCommand({
          SessionId: session.SessionId,
        })
      );
    })();
  });

  return session;
}

// Replace with actual EC2 Instance Id
const session = await createSession("i-0exxxxxxxxxxxxxxx");
const webSocket = new WebSocket(session.StreamUrl!);
const ssmSession = new SSMSession(session, webSocket, {
  autoAcknowledge: true,
});

const portForwarding = new PortForwarding(ssmSession);
webSocket.once("open", () => ssmSession.startSession());

const server = net.createServer(
  { allowHalfOpen: true, noDelay: true },
  (socket) => {
    const stream = portForwarding.newStream();

    console.info(`Client stream opened ${stream.sid}`);

    socket.pipe(
      new Writable({
        write(data, _, callback) {
          console.info(
            `Received message of size ${data.length} from mux client.`
          );

          stream.write(data);
          callback();
        },
        final(callback) {
          stream.end();
          callback();
        },
      })
    );

    stream.on("data", (data: Uint8Array) => {
      socket.write(data);
    });

    stream.on("end", () => {
      socket.end();
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

webSocket.once("close", () => {
  if (server.listening) {
    server.close();
  }
});

portForwarding.once("ready", () => {
  server.listen(6443, () => {
    console.log(
      `Listing on ${server.address().port} for sessionId ${session.SessionId}.`
    );
  });
});
```

### References

* <https://github.com/bertrandmartel/aws-ssm-session>
* <https://github.com/aws/amazon-ssm-agent>
* <https://github.com/xtaci/smux>

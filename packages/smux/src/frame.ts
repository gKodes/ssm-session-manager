export interface Frame {
  ver: number;
  cmd: number;
  sid: number;
  data: Uint8Array;
}

export interface FrameConfig {
  // SMUX Protocol version, support 1,2
  Version: number;

  // Disabled keepalive
  KeepAliveDisabled: boolean;

  // KeepAliveInterval is how often to send a NOP command to the remote
  KeepAliveInterval: number;

  // KeepAliveTimeout is how long the session
  // will be closed if no data has arrived
  KeepAliveTimeout: number;

  // MaxFrameSize is used to control the maximum
  // frame size to sent to the remote
  MaxFrameSize: number;

  // MaxReceiveBuffer is used to control the maximum
  // number of data in the buffer pool
  MaxReceiveBuffer: number;

  // MaxStreamBuffer is used to control the maximum
  // number of data per stream
  MaxStreamBuffer: number;
}

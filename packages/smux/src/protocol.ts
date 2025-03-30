// protocol version 1:
export const cmdSYN = 0; // stream open
export const cmdFIN = 1; // stream close, a.k.a EOF mark
export const cmdPSH = 2; // data push
export const cmdNOP = 3; // no operation

// protocol version 2 extra commands
// notify bytes consumed by remote peer-end
export const cmdUPD = 4;

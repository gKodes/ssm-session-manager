import { v4 as uuidv4 } from "uuid";

function toHex(source: Uint8Array): string {
  return source.reduce((prefix: string, value: number) => {
    return prefix + value.toString(16).padStart(2, "0");
  }, "");
}

export function uuidStringify(source: Uint8Array): string {
  const uuid = `${toHex(source.slice(8, 12))}-${toHex(source.slice(12, 14))}-${toHex(
    source.slice(14, 16)
  )}-${toHex(source.slice(0, 2))}-${toHex(source.slice(2, 8))}`;

  return uuid;
}

export function uuidParse(uuid: string): Uint8Array {
  const segments: string[] = uuid.split("-");

  return new Uint8Array(
    [segments[3], segments[4], segments[0], segments[1], segments[2]].flatMap((segment) =>
      segment.match(/.{1,2}/g)!.map((c) => parseInt(c, 16))
    )
  );
}

export { uuidv4 };

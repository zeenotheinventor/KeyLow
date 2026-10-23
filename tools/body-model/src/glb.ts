// A small reader and writer for the glTF binary container, for the parts of glTF this package touches.
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e4f534a;
const BINARY_CHUNK = 0x004e4942;
const HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;

export type GltfAccessor = {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  normalized?: boolean;
  count: number;
  type: string;
  min?: number[];
  max?: number[];
  sparse?: unknown;
};

export type GltfBufferView = {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
  target?: number;
};

export type GltfNode = {
  name?: string;
  mesh?: number;
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  matrix?: number[];
  extensions?: Record<string, unknown>;
};

export type GltfPrimitive = {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
};

export type Gltf = {
  asset: { version: string; generator?: string; copyright?: string };
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  extensions?: Record<string, unknown>;
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes: GltfNode[];
  meshes: { name?: string; primitives: GltfPrimitive[] }[];
  materials?: { name?: string }[];
  accessors: GltfAccessor[];
  bufferViews: GltfBufferView[];
  buffers: { byteLength: number }[];
  images?: unknown[];
  textures?: unknown[];
  cameras?: unknown[];
  animations?: unknown[];
  skins?: unknown[];
};

/** The item at an index, or a stop when there is none, so callers never handle undefined. */
export function item<T>(items: ArrayLike<T>, index: number): T {
  const found = items[index];
  if (found === undefined) {
    throw new Error(`No item at index ${index}.`);
  }
  return found;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGltf(value: unknown): value is Gltf {
  return (
    isRecord(value) &&
    isRecord(value.asset) &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.meshes) &&
    Array.isArray(value.accessors) &&
    Array.isArray(value.bufferViews) &&
    Array.isArray(value.buffers)
  );
}

function padded(bytes: Buffer, fill: number): Buffer {
  const padding = (4 - (bytes.length % 4)) % 4;
  return padding === 0 ? bytes : Buffer.concat([bytes, Buffer.alloc(padding, fill)]);
}

function chunk(type: number, bytes: Buffer): Buffer {
  const header = Buffer.alloc(CHUNK_HEADER_BYTES);
  header.writeUInt32LE(bytes.length, 0);
  header.writeUInt32LE(type, 4);
  return Buffer.concat([header, bytes]);
}

/** The JSON and the binary chunk of a .glb file. */
export function readGlb(file: Buffer): { json: Gltf; binary: Buffer } {
  if (file.length < HEADER_BYTES || file.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error("Not a glTF binary file.");
  }
  let json: unknown;
  let binary: Buffer = Buffer.alloc(0);
  let offset = HEADER_BYTES;
  while (offset < file.length) {
    const length = file.readUInt32LE(offset);
    const type = file.readUInt32LE(offset + 4);
    const bytes = file.subarray(offset + CHUNK_HEADER_BYTES, offset + CHUNK_HEADER_BYTES + length);
    if (type === JSON_CHUNK) {
      json = JSON.parse(bytes.toString("utf8"));
    } else if (type === BINARY_CHUNK) {
      binary = bytes;
    }
    offset += CHUNK_HEADER_BYTES + length;
  }
  if (!isGltf(json)) {
    throw new Error("The glTF JSON chunk is missing or has an unexpected shape.");
  }
  return { json, binary };
}

/** A .glb file with the JSON padded by spaces and the binary by zeros, as the glTF specification asks. */
export function writeGlb(json: unknown, binary: Buffer): Buffer {
  const chunks = [
    chunk(JSON_CHUNK, padded(Buffer.from(JSON.stringify(json), "utf8"), 0x20)),
    chunk(BINARY_CHUNK, padded(binary, 0)),
  ];
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(HEADER_BYTES);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(GLB_VERSION, 4);
  header.writeUInt32LE(HEADER_BYTES + body.length, 8);
  return Buffer.concat([header, body]);
}

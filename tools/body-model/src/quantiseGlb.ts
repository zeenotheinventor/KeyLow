// Rewrites a .glb so positions are normalised 16 bit integers and normals are normalised bytes, the glTF extension
// KHR_mesh_quantization. Every mesh gets one uniform scale (its half extent, because a normalised integer reads as a number from -1 to 1) and a translation on its node, which put the positions back.
// Nothing here needs WebAssembly to read: three's loader decodes it with no extra library.
import {
  type Gltf,
  type GltfAccessor,
  type GltfBufferView,
  item,
  readGlb,
  writeGlb,
} from "./glb.ts";

const EXTENSION = "KHR_mesh_quantization";
const BYTE = 5120;
const FLOAT = 5126;
const SHORT = 5122;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const POSITION_RANGE = 32767;
const NORMAL_RANGE = 127;
const COMPONENT_BYTES: Record<number, number> = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};
const COMPONENT_COUNT: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

export type QuantiseOptions = { generator: string; copyright: string; nodeOrder?: string[] };

type Piece = { accessor: GltfAccessor; view: GltfBufferView; bytes: Buffer };

function elementBytes(accessor: GltfAccessor): number {
  return (COMPONENT_BYTES[accessor.componentType] ?? 0) * (COMPONENT_COUNT[accessor.type] ?? 0);
}

/** The accessor's elements packed with no gaps, wherever the file keeps them. */
function packedBytes(json: Gltf, binary: Buffer, accessor: GltfAccessor): Buffer {
  if (accessor.sparse !== undefined || accessor.bufferView === undefined) {
    throw new Error("Sparse accessors are not supported.");
  }
  const view = item(json.bufferViews, accessor.bufferView);
  const size = elementBytes(accessor);
  const stride = view.byteStride ?? size;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const packed = Buffer.alloc(accessor.count * size);
  for (let index = 0; index < accessor.count; index += 1) {
    binary.copy(packed, index * size, start + index * stride, start + index * stride + size);
  }
  return packed;
}

function floatsOf(bytes: Buffer): Float32Array {
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
}

/** The smallest and largest value on one axis of a flat x, y, z array. */
function axisRange(values: Float32Array, axis: number): [number, number] {
  let low = Infinity;
  let high = -Infinity;
  for (let index = axis; index < values.length; index += 3) {
    low = Math.min(low, item(values, index));
    high = Math.max(high, item(values, index));
  }
  return [low, high];
}

/** Each element widened to four bytes (or eight for three shorts) so a vertex stays aligned. */
function paddedRows(values: Int8Array | Int16Array, count: number, valuesPerRow: number): Buffer {
  const rowBytes = valuesPerRow * values.BYTES_PER_ELEMENT;
  const out = Buffer.alloc(count * rowBytes);
  Buffer.from(values.buffer, values.byteOffset, values.byteLength).copy(out);
  return out;
}

function quantisePositions(positions: Float32Array, centre: number[], scale: number): Int16Array {
  const out = new Int16Array((positions.length / 3) * 4);
  for (let index = 0; index < positions.length; index += 1) {
    const axis = index % 3;
    const slot = Math.floor(index / 3) * 4 + axis;
    out[slot] = Math.round(
      ((item(positions, index) - item(centre, axis)) / scale) * POSITION_RANGE,
    );
  }
  return out;
}

function quantiseNormals(normals: Float32Array): Int8Array {
  const out = new Int8Array((normals.length / 3) * 4);
  for (let index = 0; index < normals.length; index += 1) {
    const slot = Math.floor(index / 3) * 4 + (index % 3);
    out[slot] = Math.round(Math.max(-1, Math.min(1, item(normals, index))) * NORMAL_RANGE);
  }
  return out;
}

/** The smallest and largest stored integer on one axis of rows padded to four values. */
function storedRange(stored: Int16Array, axis: number): [number, number] {
  let low = Infinity;
  let high = -Infinity;
  for (let index = axis; index < stored.length; index += 4) {
    low = Math.min(low, item(stored, index));
    high = Math.max(high, item(stored, index));
  }
  return [low, high];
}

function requireFloats(accessor: GltfAccessor, what: string): void {
  if (accessor.componentType !== FLOAT) {
    throw new Error(`${what} must be 32 bit floats before they are quantised.`);
  }
}

function withExtension(existing: string[] | undefined): string[] {
  return [...new Set([...(existing ?? []), EXTENSION])];
}

function nodeOfMesh(json: Gltf, meshIndex: number) {
  const nodes = json.nodes.filter((node) => node.mesh === meshIndex);
  if (nodes.length !== 1) {
    throw new Error(`Mesh ${meshIndex} must be used by exactly one node.`);
  }
  const node = item(nodes, 0);
  if (node.translation || node.rotation || node.scale || node.matrix) {
    throw new Error(`The node of mesh ${meshIndex} already has a transform.`);
  }
  return node;
}

export function quantiseGlb(file: Buffer, options: QuantiseOptions): Buffer {
  const { json, binary } = readGlb(file);
  const positionMesh = new Map<number, number>();
  const normalAccessors = new Set<number>();
  json.meshes.forEach((mesh, meshIndex) => {
    mesh.primitives.forEach((primitive) => {
      const position = primitive.attributes.POSITION;
      if (position === undefined || positionMesh.has(position)) {
        throw new Error("A position accessor is missing or shared by two primitives.");
      }
      positionMesh.set(position, meshIndex);
      const normal = primitive.attributes.NORMAL;
      if (normal !== undefined) {
        normalAccessors.add(normal);
      }
    });
  });

  const transforms = new Map<number, { centre: number[]; scale: number }>();
  const pieces: Piece[] = json.accessors.map((accessor, accessorIndex) => {
    const packed = packedBytes(json, binary, accessor);
    const meshIndex = positionMesh.get(accessorIndex);
    if (meshIndex !== undefined) {
      requireFloats(accessor, "Positions");
      const positions = floatsOf(packed);
      const ranges = [0, 1, 2].map((axis) => axisRange(positions, axis));
      const centre = ranges.map(([low, high]) => (low + high) / 2);
      const halfExtent = Math.max(...ranges.map(([low, high]) => (high - low) / 2));
      const scale = halfExtent > 0 ? halfExtent : 1;
      transforms.set(meshIndex, { centre, scale });
      const stored = quantisePositions(positions, centre, scale);
      const bounds = [0, 1, 2].map((axis) => storedRange(stored, axis));
      return {
        accessor: {
          componentType: SHORT,
          normalized: true,
          count: accessor.count,
          type: "VEC3",
          min: bounds.map(([low]) => low),
          max: bounds.map(([, high]) => high),
        },
        view: { buffer: 0, byteLength: 0, byteStride: 8, target: ARRAY_BUFFER },
        bytes: paddedRows(stored, accessor.count, 4),
      };
    }
    if (normalAccessors.has(accessorIndex)) {
      requireFloats(accessor, "Normals");
      return {
        accessor: { componentType: BYTE, normalized: true, count: accessor.count, type: "VEC3" },
        view: { buffer: 0, byteLength: 0, byteStride: 4, target: ARRAY_BUFFER },
        bytes: paddedRows(quantiseNormals(floatsOf(packed)), accessor.count, 4),
      };
    }
    const isIndex = accessor.type === "SCALAR";
    return {
      accessor: {
        componentType: accessor.componentType,
        count: accessor.count,
        type: accessor.type,
        ...(accessor.normalized === undefined ? {} : { normalized: accessor.normalized }),
        ...(accessor.min === undefined ? {} : { min: accessor.min }),
        ...(accessor.max === undefined ? {} : { max: accessor.max }),
      },
      view: isIndex
        ? { buffer: 0, byteLength: 0, target: ELEMENT_ARRAY_BUFFER }
        : { buffer: 0, byteLength: 0, byteStride: elementBytes(accessor), target: ARRAY_BUFFER },
      bytes: packed,
    };
  });

  const chunks: Buffer[] = [];
  let offset = 0;
  const bufferViews: GltfBufferView[] = [];
  const accessors = pieces.map((piece, index) => {
    const padding = (4 - (piece.bytes.length % 4)) % 4;
    bufferViews.push({ ...piece.view, byteOffset: offset, byteLength: piece.bytes.length });
    chunks.push(piece.bytes, Buffer.alloc(padding));
    offset += piece.bytes.length + padding;
    return { ...piece.accessor, bufferView: index };
  });

  json.meshes.forEach((_mesh, meshIndex) => {
    const transform = transforms.get(meshIndex);
    if (transform) {
      const node = nodeOfMesh(json, meshIndex);
      node.translation = transform.centre;
      node.scale = [transform.scale, transform.scale, transform.scale];
    }
  });
  const order = options.nodeOrder ?? [];
  const rank = (nodeIndex: number) => order.indexOf(item(json.nodes, nodeIndex).name ?? "");
  json.scenes?.forEach((scene) => {
    if (order.length > 0) {
      scene.nodes?.sort((a, b) => rank(a) - rank(b));
    }
  });
  const output: Gltf = {
    ...json,
    asset: { ...json.asset, generator: options.generator, copyright: options.copyright },
    extensionsUsed: withExtension(json.extensionsUsed),
    extensionsRequired: withExtension(json.extensionsRequired),
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
  };
  return writeGlb(output, Buffer.concat(chunks));
}

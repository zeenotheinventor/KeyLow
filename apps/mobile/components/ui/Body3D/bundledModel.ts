import { loadBodyModel } from "@keylow/body-3d";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";

import type { BodyModel } from "@keylow/body-3d";

async function readBundledModel(source: number): Promise<BodyModel> {
  const [asset] = await Asset.loadAsync(source);
  if (asset?.localUri == null) {
    throw new Error("The bundled body model has no file on the device.");
  }
  const bytes = await new File(asset.localUri).bytes();
  return loadBodyModel(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

// One read for each model however many canvases ask, which is also what lets `use` wait on it.
const models = new Map<number, Promise<BodyModel>>();

/** The model bundled with the app under this asset id, read once. A read that fails is tried again on the next ask. */
export function bundledModel(source: number): Promise<BodyModel> {
  const known = models.get(source);
  if (known !== undefined) {
    return known;
  }
  const model = readBundledModel(source).catch((error: unknown) => {
    models.delete(source);
    throw error;
  });
  models.set(source, model);
  return model;
}

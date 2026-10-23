// Metro turns a glb file that is imported into an asset id, which expo-asset resolves to a file.
declare module "*.glb" {
  const source: number;
  export default source;
}

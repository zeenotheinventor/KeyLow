// How many times the 3D canvas module has been read in a test file. The mock factory adds one each time it
// runs, which is the first time an import or a `require` reaches the module. It lives in its own module
// because an eager import runs the factory before the test file's own constants exist.
export const body3DCanvasReads = { count: 0 };

import { sibling } from "./sibling.js";
import path from "node:path";

const unused = 1;

const record: Record<string, string> = {};

export const joined: any = path.join("a", sibling);
export const forced = record["key"]!.length;
export const description = `${record}`;

#!/usr/bin/env node
/**
 * Copies component-pool to a sandbox/storybook environment for visual testing.
 * Configure SANDBOX_PATH in .env
 */
import { cpSync } from "fs";
import { resolve } from "path";
const src  = resolve("src/lib/component-pool");
const dest = resolve(process.env.SANDBOX_PATH ?? "sandbox/component-pool");
cpSync(src, dest, { recursive: true, force: true });
console.log("✅ Synced to", dest);

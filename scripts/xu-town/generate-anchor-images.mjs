#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..", "..");
const manifestPath = path.join(repoRoot, "scripts", "xu-town", "anchor-prompts.json");

function parseArgs(argv) {
  const options = {
    dryRun: false,
    ids: null,
    quality: null,
    size: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--id" && argv[i + 1]) {
      options.ids = new Set(argv[i + 1].split(",").map((value) => value.trim()).filter(Boolean));
      i += 1;
    } else if (arg.startsWith("--id=")) {
      options.ids = new Set(arg.slice(5).split(",").map((value) => value.trim()).filter(Boolean));
    } else if (arg === "--quality" && argv[i + 1]) {
      options.quality = argv[i + 1].trim();
      i += 1;
    } else if (arg.startsWith("--quality=")) {
      options.quality = arg.slice(10).trim();
    } else if (arg === "--size" && argv[i + 1]) {
      options.size = argv[i + 1].trim();
      i += 1;
    } else if (arg.startsWith("--size=")) {
      options.size = arg.slice(7).trim();
    }
  }

  return options;
}

async function loadManifest() {
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw);
}

function resolveEntries(entries, options) {
  return entries
    .filter((entry) => !options.ids || options.ids.has(entry.id))
    .map((entry) => ({
      ...entry,
      quality: options.quality || entry.quality,
      size: options.size || entry.size,
    }));
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function generateImage(entry, apiKey) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt: entry.prompt,
      size: entry.size,
      quality: entry.quality,
    }),
  });

  const requestId = response.headers.get("x-request-id");
  const json = await response.json();

  if (!response.ok) {
    const detail = json?.error?.message || JSON.stringify(json);
    throw new Error(`Image generation failed for ${entry.id}${requestId ? ` (${requestId})` : ""}: ${detail}`);
  }

  const imageBase64 = json?.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error(`Image generation returned no image data for ${entry.id}${requestId ? ` (${requestId})` : ""}`);
  }

  return {
    requestId,
    imageBuffer: Buffer.from(imageBase64, "base64"),
    metadata: json,
  };
}

async function writeOutputs(entry, result) {
  const imagePath = path.join(repoRoot, entry.outputPath);
  const metadataPath = imagePath.replace(/\.png$/i, ".json");

  await ensureDir(imagePath);
  await fs.writeFile(imagePath, result.imageBuffer);
  await fs.writeFile(
    metadataPath,
    JSON.stringify(
      {
        id: entry.id,
        name: entry.name,
        category: entry.category,
        size: entry.size,
        quality: entry.quality,
        outputPath: entry.outputPath,
        requestId: result.requestId || null,
        createdAt: new Date().toISOString(),
        response: result.metadata,
      },
      null,
      2
    ),
    "utf8"
  );
}

function printPlan(entries) {
  for (const entry of entries) {
    console.log(`${entry.id}  ${entry.size}  ${entry.quality}  ${entry.outputPath}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = await loadManifest();
  const entries = resolveEntries(manifest, options);

  if (entries.length === 0) {
    throw new Error("No matching anchor prompts found.");
  }

  console.log("Xu Town anchor generation plan:");
  printPlan(entries);

  if (options.dryRun) {
    console.log("\nDry run only. No API requests were made.");
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required unless --dry-run is used.");
  }

  for (const entry of entries) {
    console.log(`\nGenerating ${entry.id} (${entry.name})...`);
    const result = await generateImage(entry, apiKey);
    await writeOutputs(entry, result);
    console.log(`Saved ${entry.outputPath}${result.requestId ? ` [request_id=${result.requestId}]` : ""}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

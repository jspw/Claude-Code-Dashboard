import * as vscode from 'vscode';
import * as path from 'path';
import type { BundleFile } from './types';

export interface WriteResult {
  written: string[];
  failed: { path: string; message: string }[];
}

/** A file's text, or null when it does not exist or cannot be read. */
export async function readTextFile(absolutePath: string): Promise<string | null> {
  try {
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.file(absolutePath)));
  } catch {
    return null;
  }
}

/**
 * Writes a bundle beneath `rootPath`.
 *
 * Failures are collected per file rather than aborting the batch — a single
 * unwritable path shouldn't cost the user the rest of the export.
 */
export async function writeBundle(files: BundleFile[], rootPath: string): Promise<WriteResult> {
  const result: WriteResult = { written: [], failed: [] };
  const encoder = new TextEncoder();
  const createdDirs = new Set<string>();

  for (const file of files) {
    const absolutePath = path.join(rootPath, file.relativePath);
    try {
      const dir = path.dirname(absolutePath);
      if (!createdDirs.has(dir)) {
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
        createdDirs.add(dir);
      }
      await vscode.workspace.fs.writeFile(vscode.Uri.file(absolutePath), encoder.encode(file.content));
      result.written.push(absolutePath);
    } catch (error) {
      result.failed.push({
        path: absolutePath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

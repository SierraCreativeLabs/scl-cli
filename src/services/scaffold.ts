import { spawn } from 'child_process';
import * as fs from 'fs';
import Handlebars from 'handlebars';
import os from 'os';
import * as path from 'path';
import { z } from 'zod';

// Register Handlebars helpers for case conversions
Handlebars.registerHelper('kebabCase', (str: string) => {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-');
});

Handlebars.registerHelper('camelCase', (str: string) => {
  if (!str) return '';
  const camel = str.replace(/[-_]([a-z])/g, (_match: string, c: string) => c.toUpperCase());
  return camel.charAt(0).toLowerCase() + camel.slice(1);
});

Handlebars.registerHelper('pascalCase', (str: string) => {
  if (!str) return '';
  const camel = str.replace(/[-_]([a-z])/g, (_match: string, c: string) => c.toUpperCase());
  return camel.charAt(0).toUpperCase() + camel.slice(1);
});

Handlebars.registerHelper('lowerCase', (str: string) => {
  if (!str) return '';
  return str.toLowerCase();
});

export const TemplatePromptSchema = z.object({
  name: z.string(),
  type: z.enum(['text', 'number', 'select', 'toggle']),
  message: z.string(),
  default: z.unknown().optional(),
  choices: z.array(z.string()).optional(),
});
export const TemplateManifestSchema = z.object({
  name: z.string(),
  alias: z.string().optional(),
  description: z.string(),
  version: z.string().optional(),
  prompts: z.array(TemplatePromptSchema).optional(),
  renames: z.record(z.string(), z.string()).optional(),
});

export type TemplateManifest = z.infer<typeof TemplateManifestSchema>;

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  path: string;
  manifest: TemplateManifest;
}

export type ScaffoldProgress = (
  step: 'files' | 'hooks' | 'git' | 'install' | 'success',
  status: 'pending' | 'active' | 'success' | 'skip' | 'error'
) => void;

export interface ScaffoldOptions {
  type?: string;
  projectName?: string;
  targetPath?: string;
  description?: string;
  author?: string;
  git: boolean;
  install: boolean;
  interactive?: boolean;
  customVariables?: Record<string, unknown>;
  onProgress?: ScaffoldProgress;
}

/**
 * Loads and validates a template from a specific directory path.
 */
export function loadTemplateFromPath(templatePath: string): TemplateInfo {
  const manifestPath = path.join(templatePath, 'template.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Invalid template: template.json not found at "${templatePath}"`);
  }
  const content = fs.readFileSync(manifestPath, 'utf8');
  const raw: unknown = JSON.parse(content);
  const manifest = TemplateManifestSchema.parse(raw);
  const id = manifest.alias ?? path.basename(templatePath);

  return {
    id,
    name: manifest.name,
    description: manifest.description,
    path: templatePath,
    manifest,
  };
}

/**
 * Scans directories for templates containing template.json configs.
 */
export function resolveTemplates(): TemplateInfo[] {
  const lookupDirs = [
    process.env.SCL_TEMPLATES_DIR ? path.resolve(process.env.SCL_TEMPLATES_DIR) : null,
    path.resolve(process.cwd(), '.scl-templates'),
    path.resolve(os.homedir(), '.scl-cli/cache/templates'), // git cache
    path.resolve(os.homedir(), '.scl-cli/templates'),
    path.resolve(import.meta.dir, '../../../templates'), // root templates folder (outside cli tool)
    path.resolve(import.meta.dir, '../../templates'), // fallback to built-in CLI templates (dev mode)
    path.resolve(import.meta.dir, '../templates'), // fallback to built-in CLI templates (built mode)
  ].filter((dir): dir is string => dir !== null);

  const templates: TemplateInfo[] = [];
  const seenIds = new Set<string>();

  for (const dir of lookupDirs) {
    if (!fs.existsSync(dir)) continue;

    try {
      const children = fs.readdirSync(dir, { withFileTypes: true });
      for (const child of children) {
        if (!child.isDirectory()) continue;

        const templatePath = path.join(dir, child.name);
        try {
          const tInfo = loadTemplateFromPath(templatePath);
          if (!seenIds.has(tInfo.id)) {
            seenIds.add(tInfo.id);
            templates.push(tInfo);
          }
        } catch {
          // Skip individual invalid template folders
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  return templates;
}

/**
 * Checks if a string looks like a Git URL.
 */
export function isGitUrl(str: string): boolean {
  return (
    str.startsWith('http://') ||
    str.startsWith('https://') ||
    str.startsWith('git@') ||
    str.startsWith('ssh://') ||
    str.endsWith('.git')
  );
}

/**
 * Downloads a git repository containing a template to the local cache.
 */
export async function downloadGitTemplate(url: string): Promise<string> {
  const cacheDir = path.resolve(os.homedir(), '.scl-cli/cache/templates');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const sanitizedFolderName = url.replace(/[^a-zA-Z0-9]/g, '-');
  const repoCachePath = path.join(cacheDir, sanitizedFolderName);

  if (fs.existsSync(repoCachePath)) {
    try {
      // Try updating via git pull
      await runCommand('git', ['pull'], repoCachePath);
      return repoCachePath;
    } catch {
      // If pull fails, clean up and clone fresh
      fs.rmSync(repoCachePath, { recursive: true, force: true });
    }
  }

  // Clone fresh
  await runCommand('git', ['clone', url, repoCachePath], cacheDir);
  return repoCachePath;
}


/**
 * Runs a command in a child process, ignoring its output streams.
 */
async function runCommand(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: 'ignore' });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${cmd} ${args.join(' ')} failed with exit code ${code}`));
    });
    proc.on('error', err => {
      reject(err);
    });
  });
}

/**
 * Triggers package manager dependency installation.
 */
async function installDependencies(cwd: string): Promise<void> {
  try {
    await runCommand('bun', ['install'], cwd);
  } catch {
    try {
      await runCommand('npm', ['install'], cwd);
    } catch (npmErr) {
      throw new Error(`Failed to install dependencies: ${String(npmErr)}`, { cause: npmErr });
    }
  }
}

/**
 * Recursively copies and compiles files using Handlebars templates.
 */
export function generateFiles(
  templatePath: string,
  targetPath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: Record<string, any>,
  renames: Record<string, string> = {}
): void {
  const filesPath = path.join(templatePath, 'files');
  if (!fs.existsSync(filesPath)) {
    throw new Error(`Template files directory not found: ${filesPath}`);
  }

  const recurse = (currentDir: string, destDir: string) => {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const items = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const item of items) {
      const sourceItemPath = path.join(currentDir, item.name);

      let destItemName = item.name;
      if (destItemName.includes('{{')) {
        const pathTemplate = Handlebars.compile(destItemName);
        destItemName = pathTemplate(variables);
      }

      const renamed = renames[destItemName];
      if (renamed !== undefined) {
        destItemName = renamed;
      }

      const destItemPath = path.join(destDir, destItemName);

      if (item.isDirectory()) {
        recurse(sourceItemPath, destItemPath);
      } else {
        const content = fs.readFileSync(sourceItemPath, 'utf8');
        const compiledTemplate = Handlebars.compile(content);
        const compiledContent = compiledTemplate(variables);
        fs.writeFileSync(destItemPath, compiledContent, 'utf8');
      }
    }
  };

  recurse(filesPath, targetPath);
}

/**
 * Executes the scaffolding process.
 */
export async function runScaffold(options: ScaffoldOptions): Promise<void> {
  const templates = resolveTemplates();
  const selectedTemplate = templates.find(t => t.id === options.type);
  if (!selectedTemplate) {
    throw new Error(`Scaffold template not found for type: "${options.type ?? ''}"`);
  }

  const targetDirName = options.projectName ?? `my-${selectedTemplate.id}-project`;
  const parentPath = options.targetPath ?? process.cwd();
  const targetPath = path.resolve(parentPath, targetDirName);

  if (fs.existsSync(targetPath)) {
    throw new Error(`Target directory already exists: "${targetPath}"`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const variables: Record<string, any> = {
    projectName: targetDirName,
    description: options.description ?? selectedTemplate.description,
    author: options.author ?? 'Developer',
    year: new Date().getFullYear(),
    ...options.customVariables,
  };

  // Initialize variables from manifest prompts
  if (selectedTemplate.manifest.prompts) {
    for (const prompt of selectedTemplate.manifest.prompts) {
      if (variables[prompt.name] === undefined) {
        variables[prompt.name] = prompt.default;
      }
    }
  }

  if (options.onProgress) options.onProgress('files', 'active');
  try {
    // Compile and write files
    generateFiles(selectedTemplate.path, targetPath, variables, selectedTemplate.manifest.renames);
    if (options.onProgress) options.onProgress('files', 'success');
  } catch (err) {
    if (options.onProgress) options.onProgress('files', 'error');
    throw err;
  }

  // Lifecycle hooks placeholder
  if (options.onProgress) options.onProgress('hooks', 'active');
  await new Promise(resolve => setTimeout(resolve, 300));
  if (options.onProgress) options.onProgress('hooks', 'success');

  // Initialize Git
  if (options.git) {
    if (options.onProgress) options.onProgress('git', 'active');
    try {
      await runCommand('git', ['init'], targetPath);
      if (options.onProgress) options.onProgress('git', 'success');
    } catch (err) {
      if (options.onProgress) options.onProgress('git', 'error');
      // Non-fatal, just warn
      console.warn('⚠️ Warning: Failed to initialize Git repository:', String(err));
    }
  } else {
    if (options.onProgress) options.onProgress('git', 'skip');
  }

  // Install dependencies
  if (options.install) {
    if (options.onProgress) options.onProgress('install', 'active');
    try {
      await installDependencies(targetPath);
      if (options.onProgress) options.onProgress('install', 'success');
    } catch (err) {
      if (options.onProgress) options.onProgress('install', 'error');
      throw err;
    }
  } else {
    if (options.onProgress) options.onProgress('install', 'skip');
  }

  if (options.onProgress) options.onProgress('success', 'success');
}

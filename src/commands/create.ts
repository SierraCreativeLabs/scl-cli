import React from 'react';

import { render } from 'ink';

import { Command } from 'commander';

import { resolveTemplates, runScaffold, isGitUrl, downloadGitTemplate, loadTemplateFromPath } from '../services/scaffold';
import { InteractiveApp } from '../ui/InteractiveApp';

interface CreateCommandOptions {
  description?: string;
  author?: string;
  git: boolean;
  install: boolean;
  yes: boolean;
  interactive: boolean;
  var?: string[];
}

export const createCommand = new Command('create')
  .description('Generate a new project scaffold')
  .argument('[type]', 'Template name/alias (e.g. hono-microservice) or a Git repository URL')
  .argument('[project-name]', 'Name of the project directory')
  .argument('[target-path]', 'Directory where the project folder will be created (default: current directory)')
  .option('-d, --description <desc>', 'Project description')
  .option('-a, --author <name>', 'Author name')
  .option('-g, --git', 'Initialize a Git repository', true)
  .option('--no-git', 'Disable Git repository initialization')
  .option('-i, --install', 'Install dependencies automatically', true)
  .option('--no-install', 'Skip dependency installation')
  .option('-y, --yes', 'Skip interactive prompts (requires type to be provided)', false)
  .option('--interactive', 'Force interactive mode', false)
  .option(
    '--var <key=value>',
    'Custom template variables (can be specified multiple times)',
    (val, memo: string[]) => {
      memo.push(val);
      return memo;
    },
    []
  )
  .action(
    async (
      type: string | undefined,
      projectName: string | undefined,
      targetPath: string | undefined,
      options: CreateCommandOptions
    ) => {
      let templates = resolveTemplates();
      let templateType = type;

      // Handle Git URLs for remote templates
      if (type && isGitUrl(type)) {
        console.log(`📥 Cloning/updating remote git template: ${type}...`);
        try {
          const cachedPath = await downloadGitTemplate(type);
          const templateInfo = loadTemplateFromPath(cachedPath);
          templateType = templateInfo.id;
          // Re-resolve templates to include the newly cached template
          templates = resolveTemplates();
          console.log(`✓ Template loaded: "${templateInfo.name}" (${templateInfo.id})`);
        } catch (err) {
          console.error(`❌ Failed to download git template: ${String(err)}`);
          process.exit(1);
        }
      }

      // Verify if provided type matches a valid template
      if (templateType) {
        const template = templates.find(t => t.id === templateType);
        if (!template) {
          console.error(`Error: Unknown project type "${templateType}".`);
          console.error('Available types:');
          for (const t of templates) {
            console.error(`  - ${t.id} (${t.name}): ${t.description}`);
          }
          process.exit(1);
        }
      }

      // Parse custom variables (e.g. --var entity=User)
      const customVariables: Record<string, string> = {};
      if (options.var) {
        for (const pair of options.var) {
          const index = pair.indexOf('=');
          if (index !== -1) {
            const key = pair.slice(0, index).trim();
            const val = pair.slice(index + 1).trim();
            customVariables[key] = val;
          }
        }
      }

      // If running in non-interactive mode (--yes), require a type
      if (options.yes && !templateType) {
        console.error('Error: Project type is required when running in non-interactive mode (--yes).');
        process.exit(1);
      }

      // Determine if we should fall back to interactive mode.
      // If the user did not explicitly request non-interactive mode (--yes), we launch the interactive TUI.
      const isInteractive = !options.yes;

      if (isInteractive) {
        if (!process.stdin.isTTY) {
          console.error('⚠️  Interactive TUI mode is not supported in this terminal environment (non-TTY).');
          console.error('Please specify the project type and use the non-interactive flags instead.');
          console.error('Example: bun run dev create ms my-project --yes');
          process.exit(1);
        }

        const templatesList = templates.map(t => ({
          value: t.id,
          label: t.name,
          description: t.description,
        }));

        const { waitUntilExit } = render(
          React.createElement(InteractiveApp, {
            initialType: templateType,
            initialProjectName: projectName,
            initialTargetPath: targetPath,
            initialDescription: options.description,
            initialAuthor: options.author,
            initialGit: options.git,
            initialInstall: options.install,
            templatesList,
            customVariables,
          })
        );
        await waitUntilExit();
      } else {
        try {
          await runScaffold({
            type: templateType,
            projectName,
            targetPath,
            description: options.description,
            author: options.author,
            git: options.git !== false,
            install: options.install !== false,
            interactive: false,
            customVariables,
          });
        } catch (err) {
          console.error(`❌ Scaffolding failed: ${String(err)}`);
          process.exit(1);
        }
      }
    }
  );

import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { runScaffold } from '../services/scaffold';
import { InteractiveApp } from '../ui/InteractiveApp';

export const createCommand = new Command('create')
  .description('Generate a new project scaffold')
  .argument('[type]', 'Type/alias of the project scaffold (e.g. ms, microservice)')
  .argument('[project-name]', 'Name of the project directory')
  .option('-d, --description <desc>', 'Project description')
  .option('-a, --author <name>', 'Author name')
  .option('-g, --git', 'Initialize a Git repository', true)
  .option('--no-git', 'Disable Git repository initialization')
  .option('-i, --install', 'Install dependencies automatically', true)
  .option('--no-install', 'Skip dependency installation')
  .option('-y, --yes', 'Skip interactive prompts (requires type to be provided)', false)
  .option('--interactive', 'Force interactive mode', false)
  .action(async (type, projectName, options) => {
    // If running in non-interactive mode (--yes), require a type
    if (options.yes && !type) {
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

      const { waitUntilExit } = render(
        React.createElement(InteractiveApp, {
          initialType: type,
          initialProjectName: projectName,
          initialDescription: options.description,
          initialAuthor: options.author,
          initialGit: options.git,
          initialInstall: options.install,
        })
      );
      await waitUntilExit();
    } else {
      await runScaffold({
        type,
        projectName,
        description: options.description,
        author: options.author,
        git: options.git !== false,
        install: options.install !== false,
        interactive: false,
      });
    }
  });

import { Command } from 'commander';

import { createCommand } from './commands/create';

const program = new Command();

program
  .name('scl-cli')
  .description('A high-performance, developer-friendly CLI for project generation and scaffolding.')
  .version('0.0.1');

program.addCommand(createCommand);

program.parse(process.argv);

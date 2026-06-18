# SCL CLI (Sierra Creative Labs Scaffolding System)

`scl-cli` is a high-performance, developer-friendly scaffolding command-line tool built using **Bun**, **TypeScript**, **React/Ink** (for terminal TUIs), and **Handlebars** (for template compilation). It is designed to quickly generate new projects, microservices, or modules using standardized architectural layouts and strict developer tooling.

---

## Key Features

* **Interactive Ink TUI:** Rich terminal user interface with step-by-step guidance, spinner animations, and error handling.
* **Remote Git Templates:** Pass a Git repository URL (e.g. GitHub repo) directly as the template type. The CLI automatically clones, caches, and parses its configuration.
* **Dynamic Manifest Prompts:** Templates can declare custom prompts (like asking for an `entity` name) in a `template.json` file. The CLI parses these and injects them as interactive steps or matches them to CLI variables.
* **Built-in Case Helpers:** Supports Handlebars case transformations for paths, filenames, and file content:
  * `{{pascalCase var}}` (e.g. `GreetingController`, `GreetingInMemoryRepository`)
  * `{{kebabCase var}}` (e.g. `greeting-controller.ts`)
  * `{{camelCase var}}` (e.g. `greetingRepository`)
  * `{{lowerCase var}}` (e.g. `greeting`)
* **Flexible Lookup Hierarchy:** Searches for templates in:
  1. `SCL_TEMPLATES_DIR` environment variable
  2. Local directory `.scl-templates`
  3. Git-cached templates directory `~/.scl-cli/cache/templates`
  4. Global user directory `~/.scl-cli/templates`
  5. Built-in CLI templates folder

---

## Installation

### Option 1: Live Link for Active Development (Recommended)
Symlinks the executable into your global `PATH`, automatically reflecting any compiled changes:
```bash
# 1. Build the CLI package
bun run build

# 2. Link it globally
npm link
```

### Option 2: Standalone Compiled Binary
Compiles the TypeScript entry point into a single, self-contained binary including the Bun runtime:
```bash
# 1. Compile to a standalone binary
bun build ./src/index.ts --compile --outfile scl-cli

# 2. Move to a folder in your PATH
mv scl-cli ~/.local/bin/
```

---

## Usage Guide

Run the CLI help command to see all available arguments and options:
```bash
scl-cli create --help
```

### 1. Interactive Mode (Default)
Simply run `create` without the `--yes` flag to open the terminal user interface:
```bash
scl-cli create
```
You will be prompted to select the template, enter the project name, configure target paths, enter description/author details, respond to template-specific questions, and decide on Git initialization and dependency installation.

### 2. Non-Interactive Mode (`--yes` / `-y`)
Perfect for CI/CD pipelines or automation scripts:
```bash
scl-cli create hono-microservice my-service-dir --yes --description "Hono Microservice API" --author "Developer"
```

### 3. Using Remote Git Templates
You can pass any Git/GitHub repository URL ending in `.git` or starting with HTTP/SSH protocols directly:
```bash
scl-cli create https://github.com/Sierra-Creative-Labs/hono-microservice-template.git my-service-dir
```
*The CLI will automatically pull/clone it to `~/.scl-cli/cache/templates/` and load it.*

### 4. Specifying Custom Variables
Pass custom template variables directly using the `--var` option (useful in non-interactive mode):
```bash
scl-cli create hono-microservice my-project --yes --var entity=User
```

---

## Creating Your Own Templates

Templates must have the following structure:
```
my-template-folder/
├── template.json
└── files/
    ├── package.json
    ├── tsconfig.json
    └── src/
        └── adapters/
            └── in/
                └── http/
                    └── {{kebabCase entity}}.controller.ts
```

### Template Manifest (`template.json`)
The manifest configures the metadata, alias, and custom prompts to ask:
```json
{
  "name": "Hono Microservice",
  "alias": "hono-microservice",
  "description": "A high-performance HTTP microservice using Hono and Hexagonal Architecture",
  "version": "1.0.0",
  "prompts": [
    {
      "name": "entity",
      "type": "text",
      "message": "Initial domain entity name (e.g. User, Product)",
      "default": "Greeting"
    }
  ]
}
```

---

## License

Proprietary — Sierra Creative Labs.

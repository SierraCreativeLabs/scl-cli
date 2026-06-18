#!/usr/bin/env bun
// @bun

// src/index.ts
import { Command as Command2 } from "commander";

// src/commands/create.ts
import React3 from "react";
import { render } from "ink";
import { Command } from "commander";

// src/services/scaffold.ts
import { spawn } from "child_process";
import * as fs from "fs";
import Handlebars from "handlebars";
import os from "os";
import * as path from "path";
import { z } from "zod";
Handlebars.registerHelper("kebabCase", (str) => {
  if (!str)
    return "";
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-");
});
Handlebars.registerHelper("camelCase", (str) => {
  if (!str)
    return "";
  const camel = str.replace(/[-_]([a-z])/g, (_match, c) => c.toUpperCase());
  return camel.charAt(0).toLowerCase() + camel.slice(1);
});
Handlebars.registerHelper("pascalCase", (str) => {
  if (!str)
    return "";
  const camel = str.replace(/[-_]([a-z])/g, (_match, c) => c.toUpperCase());
  return camel.charAt(0).toUpperCase() + camel.slice(1);
});
Handlebars.registerHelper("lowerCase", (str) => {
  if (!str)
    return "";
  return str.toLowerCase();
});
var TemplatePromptSchema = z.object({
  name: z.string(),
  type: z.enum(["text", "number", "select", "toggle"]),
  message: z.string(),
  default: z.unknown().optional(),
  choices: z.array(z.string()).optional()
});
var TemplateManifestSchema = z.object({
  name: z.string(),
  alias: z.string().optional(),
  description: z.string(),
  version: z.string().optional(),
  prompts: z.array(TemplatePromptSchema).optional(),
  renames: z.record(z.string(), z.string()).optional()
});
function loadTemplateFromPath(templatePath) {
  const manifestPath = path.join(templatePath, "template.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Invalid template: template.json not found at "${templatePath}"`);
  }
  const content = fs.readFileSync(manifestPath, "utf8");
  const raw = JSON.parse(content);
  const manifest = TemplateManifestSchema.parse(raw);
  const id = manifest.alias ?? path.basename(templatePath);
  return {
    id,
    name: manifest.name,
    description: manifest.description,
    path: templatePath,
    manifest
  };
}
var TEMPLATE_REGISTRY = [
  {
    id: "hono-microservice",
    name: "Hono Microservice",
    description: "A high-performance HTTP microservice using Bun and Hono with Hexagonal Architecture",
    gitUrl: "https://github.com/SierraCreativeLabs/hono-ms-template.git"
  }
];
function resolveTemplates() {
  const lookupDirs = [
    process.env.SCL_TEMPLATES_DIR ? path.resolve(process.env.SCL_TEMPLATES_DIR) : null,
    path.resolve(process.cwd(), ".scl-templates"),
    path.resolve(os.homedir(), ".scl-cli/cache/templates"),
    path.resolve(os.homedir(), ".scl-cli/templates"),
    path.resolve(import.meta.dir, "../../../templates"),
    path.resolve(import.meta.dir, "../../templates"),
    path.resolve(import.meta.dir, "../templates")
  ].filter((dir) => dir !== null);
  const templates = [];
  const seenIds = new Set;
  for (const dir of lookupDirs) {
    if (!fs.existsSync(dir))
      continue;
    try {
      const children = fs.readdirSync(dir, { withFileTypes: true });
      for (const child of children) {
        if (!child.isDirectory())
          continue;
        const templatePath = path.join(dir, child.name);
        try {
          const tInfo = loadTemplateFromPath(templatePath);
          if (!seenIds.has(tInfo.id)) {
            seenIds.add(tInfo.id);
            templates.push(tInfo);
          }
        } catch {}
      }
    } catch {}
  }
  for (const reg of TEMPLATE_REGISTRY) {
    if (!seenIds.has(reg.id)) {
      seenIds.add(reg.id);
      templates.push({
        id: reg.id,
        name: `${reg.name} (Remote)`,
        description: reg.description,
        path: reg.gitUrl,
        manifest: {
          name: reg.name,
          description: reg.description,
          prompts: []
        }
      });
    }
  }
  return templates;
}
function isGitUrl(str) {
  return str.startsWith("http://") || str.startsWith("https://") || str.startsWith("git@") || str.startsWith("ssh://") || str.endsWith(".git");
}
async function downloadGitTemplate(url) {
  const cacheDir = path.resolve(os.homedir(), ".scl-cli/cache/templates");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  const sanitizedFolderName = url.replace(/[^a-zA-Z0-9]/g, "-");
  const repoCachePath = path.join(cacheDir, sanitizedFolderName);
  if (fs.existsSync(repoCachePath)) {
    try {
      await runCommand("git", ["pull"], repoCachePath);
      return repoCachePath;
    } catch {
      fs.rmSync(repoCachePath, { recursive: true, force: true });
    }
  }
  await runCommand("git", ["clone", url, repoCachePath], cacheDir);
  return repoCachePath;
}
async function runCommand(cmd, args, cwd) {
  return new Promise((resolve2, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: "ignore" });
    proc.on("close", (code) => {
      if (code === 0)
        resolve2();
      else
        reject(new Error(`Command ${cmd} ${args.join(" ")} failed with exit code ${code}`));
    });
    proc.on("error", (err) => {
      reject(err);
    });
  });
}
async function installDependencies(cwd) {
  try {
    await runCommand("bun", ["install"], cwd);
  } catch {
    try {
      await runCommand("npm", ["install"], cwd);
    } catch (npmErr) {
      throw new Error(`Failed to install dependencies: ${String(npmErr)}`, { cause: npmErr });
    }
  }
}
function generateFiles(templatePath, targetPath, variables, renames = {}) {
  const filesPath = path.join(templatePath, "files");
  if (!fs.existsSync(filesPath)) {
    throw new Error(`Template files directory not found: ${filesPath}`);
  }
  const recurse = (currentDir, destDir) => {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of items) {
      const sourceItemPath = path.join(currentDir, item.name);
      let destItemName = item.name;
      if (destItemName.includes("{{")) {
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
        const content = fs.readFileSync(sourceItemPath, "utf8");
        const compiledTemplate = Handlebars.compile(content);
        const compiledContent = compiledTemplate(variables);
        fs.writeFileSync(destItemPath, compiledContent, "utf8");
      }
    }
  };
  recurse(filesPath, targetPath);
}
async function runScaffold(options) {
  const templates = resolveTemplates();
  let selectedTemplate = templates.find((t) => t.id === options.type);
  if (!selectedTemplate) {
    throw new Error(`Scaffold template not found for type: "${options.type ?? ""}"`);
  }
  if (isGitUrl(selectedTemplate.path)) {
    try {
      const cachedPath = await downloadGitTemplate(selectedTemplate.path);
      selectedTemplate = loadTemplateFromPath(cachedPath);
    } catch (err) {
      throw new Error(`Failed to download remote template "${selectedTemplate.name}": ${String(err)}`, { cause: err });
    }
  }
  const targetDirName = options.projectName ?? `my-${selectedTemplate.id}-project`;
  const parentPath = options.targetPath ?? process.cwd();
  const targetPath = path.resolve(parentPath, targetDirName);
  if (fs.existsSync(targetPath)) {
    throw new Error(`Target directory already exists: "${targetPath}"`);
  }
  const variables = {
    projectName: targetDirName,
    description: options.description ?? selectedTemplate.description,
    author: options.author ?? "Developer",
    year: new Date().getFullYear(),
    ...options.customVariables
  };
  if (selectedTemplate.manifest.prompts) {
    for (const prompt of selectedTemplate.manifest.prompts) {
      if (variables[prompt.name] === undefined) {
        variables[prompt.name] = prompt.default;
      }
    }
  }
  if (options.onProgress)
    options.onProgress("files", "active");
  try {
    generateFiles(selectedTemplate.path, targetPath, variables, selectedTemplate.manifest.renames);
    if (options.onProgress)
      options.onProgress("files", "success");
  } catch (err) {
    if (options.onProgress)
      options.onProgress("files", "error");
    throw err;
  }
  if (options.onProgress)
    options.onProgress("hooks", "active");
  await new Promise((resolve2) => setTimeout(resolve2, 300));
  if (options.onProgress)
    options.onProgress("hooks", "success");
  if (options.git) {
    if (options.onProgress)
      options.onProgress("git", "active");
    try {
      await runCommand("git", ["init"], targetPath);
      if (options.onProgress)
        options.onProgress("git", "success");
    } catch (err) {
      if (options.onProgress)
        options.onProgress("git", "error");
      console.warn("\u26A0\uFE0F Warning: Failed to initialize Git repository:", String(err));
    }
  } else {
    if (options.onProgress)
      options.onProgress("git", "skip");
  }
  if (options.install) {
    if (options.onProgress)
      options.onProgress("install", "active");
    try {
      await installDependencies(targetPath);
      if (options.onProgress)
        options.onProgress("install", "success");
    } catch (err) {
      if (options.onProgress)
        options.onProgress("install", "error");
      throw err;
    }
  } else {
    if (options.onProgress)
      options.onProgress("install", "skip");
  }
  if (options.onProgress)
    options.onProgress("success", "success");
}

// src/ui/InteractiveApp.tsx
import { useEffect, useState as useState2 } from "react";
import { Box as Box4, Text as Text4, useApp, useInput as useInput4 } from "ink";
import Link from "ink-link";
import Spinner from "ink-spinner";

// src/components/Select.tsx
import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { jsxDEV } from "react/jsx-dev-runtime";
var Select = ({ items, onSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => prev > 0 ? prev - 1 : items.length - 1);
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => prev < items.length - 1 ? prev + 1 : 0);
    }
    if (key.return) {
      const selectedItem = items[selectedIndex];
      if (selectedItem) {
        onSelect(selectedItem);
      }
    }
  });
  return /* @__PURE__ */ jsxDEV(Box, {
    flexDirection: "column",
    marginY: 1,
    children: items.map((item, index) => {
      const isSelected = index === selectedIndex;
      return /* @__PURE__ */ jsxDEV(Box, {
        children: [
          /* @__PURE__ */ jsxDEV(Text, {
            color: isSelected ? "violet" : "gray",
            children: isSelected ? " \u203A " : "   "
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV(Text, {
            color: isSelected ? "violet" : "white",
            bold: isSelected,
            children: item.label
          }, undefined, false, undefined, this)
        ]
      }, item.value, true, undefined, this);
    })
  }, undefined, false, undefined, this);
};

// src/components/TextInput.tsx
import { Box as Box2, Text as Text2, useInput as useInput2 } from "ink";
import { jsxDEV as jsxDEV2 } from "react/jsx-dev-runtime";
var TextInput = ({ value, placeholder = "", onChange, onSubmit }) => {
  useInput2((input, key) => {
    if (key.return) {
      if (onSubmit)
        onSubmit(value);
      return;
    }
    if (key.backspace) {
      onChange(value.slice(0, -1));
      return;
    }
    if (key.ctrl || key.escape || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow || key.tab) {
      return;
    }
    onChange(value + input);
  });
  const hasValue = value.length > 0;
  return /* @__PURE__ */ jsxDEV2(Box2, {
    children: [
      hasValue ? /* @__PURE__ */ jsxDEV2(Text2, {
        color: "cyan",
        children: value
      }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV2(Text2, {
        color: "gray",
        children: placeholder
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV2(Text2, {
        color: "violet",
        bold: true,
        children: "\u2503"
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
};

// src/components/Toggle.tsx
import { Box as Box3, Text as Text3, useInput as useInput3 } from "ink";
import { jsxDEV as jsxDEV3 } from "react/jsx-dev-runtime";
var Toggle = ({ value, onChange, onSubmit }) => {
  useInput3((input, key) => {
    if (key.leftArrow || key.rightArrow || input === " ") {
      onChange(!value);
    }
    if (key.return) {
      onSubmit();
    }
  });
  return /* @__PURE__ */ jsxDEV3(Box3, {
    marginY: 1,
    children: [
      /* @__PURE__ */ jsxDEV3(Text3, {
        color: value ? "violet" : "gray",
        bold: value,
        children: value ? "\u2714 Yes" : "  Yes"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV3(Text3, {
        color: "gray",
        children: " / "
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV3(Text3, {
        color: !value ? "violet" : "gray",
        bold: !value,
        children: !value ? "\u2714 No" : "  No"
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
};

// src/ui/InteractiveApp.tsx
import { jsxDEV as jsxDEV4, Fragment } from "react/jsx-dev-runtime";
var InteractiveApp = ({
  initialType = "",
  initialProjectName = "",
  initialTargetPath = "",
  initialDescription = "",
  initialAuthor = "",
  initialGit = true,
  initialInstall = true,
  templatesList,
  customVariables
}) => {
  const { exit } = useApp();
  const [type, setType] = useState2(initialType);
  const [projectName, setProjectName] = useState2(initialProjectName);
  const [targetPath, setTargetPath] = useState2(initialTargetPath);
  const [description, setDescription] = useState2(initialDescription);
  const [author, setAuthor] = useState2(initialAuthor);
  const [git, setGit] = useState2(initialGit);
  const [install, setInstall] = useState2(initialInstall);
  const [promptsState, setPromptsState] = useState2({});
  const [filesStatus, setFilesStatus] = useState2("pending");
  const [hooksStatus, setHooksStatus] = useState2("pending");
  const [gitStatus, setGitStatus] = useState2("pending");
  const [installStatus, setInstallStatus] = useState2("pending");
  const [errorMessage, setErrorMessage] = useState2("");
  const [isDownloading, setIsDownloading] = useState2(false);
  const [downloadError, setDownloadError] = useState2("");
  useEffect(() => {
    if (type && isDownloading) {
      const performDownload = async () => {
        try {
          const selected = templates.find((t) => t.id === type);
          if (selected && isGitUrl(selected.path)) {
            await downloadGitTemplate(selected.path);
          }
          setIsDownloading(false);
          handleNext();
        } catch (err) {
          setDownloadError(String(err));
          setIsDownloading(false);
        }
      };
      performDownload();
    }
  }, [type, isDownloading]);
  const templates = resolveTemplates();
  const selectedTemplate = templates.find((t) => t.id === type);
  const customPrompts = selectedTemplate?.manifest.prompts || [];
  const steps = [];
  if (!initialType)
    steps.push("TYPE");
  if (!initialProjectName)
    steps.push("NAME");
  if (!initialTargetPath)
    steps.push("PATH");
  if (!initialDescription)
    steps.push("DESCRIPTION");
  if (!initialAuthor)
    steps.push("AUTHOR");
  for (const p of customPrompts) {
    steps.push(`PROMPT_${p.name}`);
  }
  steps.push("GIT");
  steps.push("INSTALL");
  steps.push("CONFIRM");
  steps.push("GENERATING");
  steps.push("SUCCESS");
  const [currentStepIndex, setCurrentStepIndex] = useState2(0);
  const currentStep = steps[currentStepIndex];
  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };
  useEffect(() => {
    if (currentStep === "GENERATING") {
      const executeScaffold = async () => {
        try {
          await runScaffold({
            type,
            projectName: projectName || undefined,
            targetPath: targetPath || undefined,
            description: description || undefined,
            author: author || undefined,
            git,
            install,
            interactive: true,
            customVariables: {
              ...customVariables,
              ...promptsState
            },
            onProgress: (step, status) => {
              if (step === "files" && status !== "skip")
                setFilesStatus(status);
              if (step === "hooks" && status !== "skip")
                setHooksStatus(status);
              if (step === "git")
                setGitStatus(status);
              if (step === "install")
                setInstallStatus(status);
            }
          });
          handleNext();
        } catch (err) {
          setErrorMessage(String(err));
        }
      };
      executeScaffold();
    }
  }, [currentStep]);
  useInput4((input, key) => {
    if (key.escape) {
      exit();
      return;
    }
    if ((errorMessage || downloadError) && key.return) {
      exit();
      return;
    }
    if (currentStep === "CONFIRM" && key.return) {
      handleNext();
    }
    if (currentStep === "SUCCESS" && key.return) {
      exit();
    }
  });
  const projectTypes = templatesList.map((t) => ({
    label: `${t.label} (${t.value})`,
    value: t.value
  }));
  const getStatusColor = (status) => {
    if (status === "success")
      return "green";
    if (status === "active")
      return "violet";
    if (status === "skip")
      return "gray";
    if (status === "error")
      return "red";
    return "gray";
  };
  const getStatusSymbol = (status) => {
    if (status === "success")
      return "\u2714";
    if (status === "active")
      return /* @__PURE__ */ jsxDEV4(Spinner, {
        type: "dots"
      }, undefined, false, undefined, this);
    if (status === "skip")
      return "\uD83C\uDDF8";
    if (status === "error")
      return "\u2716";
    return "\u25CC";
  };
  return /* @__PURE__ */ jsxDEV4(Box4, {
    flexDirection: "column",
    margin: 1,
    children: [
      /* @__PURE__ */ jsxDEV4(Box4, {
        borderStyle: "round",
        borderColor: "violet",
        paddingX: 2,
        paddingY: 0,
        marginBottom: 1,
        flexDirection: "column",
        children: [
          /* @__PURE__ */ jsxDEV4(Text4, {
            color: "violet",
            bold: true,
            children: "S C L - C L I"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV4(Text4, {
            color: "gray",
            children: "Sierra Creative Labs Scaffolding System"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      currentStep !== "GENERATING" && currentStep !== "SUCCESS" && /* @__PURE__ */ jsxDEV4(Box4, {
        marginBottom: 1,
        children: [
          /* @__PURE__ */ jsxDEV4(Text4, {
            color: "violet",
            bold: true,
            children: [
              "Step ",
              currentStepIndex + 1,
              " of ",
              steps.length - 2,
              ":",
              " "
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV4(Text4, {
            color: "white",
            bold: true,
            underline: true,
            children: [
              currentStep === "TYPE" && "Select Project Type",
              currentStep === "NAME" && "Enter Project Name",
              currentStep === "PATH" && "Enter Installation Path",
              currentStep === "DESCRIPTION" && "Enter Project Description",
              currentStep === "AUTHOR" && "Enter Author Name",
              currentStep?.startsWith("PROMPT_") && `Enter Custom Prompt: ${currentStep.replace("PROMPT_", "")}`,
              currentStep === "GIT" && "Initialize Git Repository?",
              currentStep === "INSTALL" && "Install Dependencies?",
              currentStep === "CONFIRM" && "Confirm Configuration"
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV4(Box4, {
        flexDirection: "column",
        minHeight: 6,
        children: isDownloading ? /* @__PURE__ */ jsxDEV4(Box4, {
          flexDirection: "column",
          padding: 1,
          children: /* @__PURE__ */ jsxDEV4(Text4, {
            color: "cyan",
            children: [
              /* @__PURE__ */ jsxDEV4(Spinner, {
                type: "dots"
              }, undefined, false, undefined, this),
              " \uD83D\uDCE5 Downloading and caching remote template: ",
              /* @__PURE__ */ jsxDEV4(Text4, {
                color: "violet",
                bold: true,
                children: type
              }, undefined, false, undefined, this),
              "..."
            ]
          }, undefined, true, undefined, this)
        }, undefined, false, undefined, this) : downloadError ? /* @__PURE__ */ jsxDEV4(Box4, {
          flexDirection: "column",
          borderStyle: "double",
          borderColor: "red",
          padding: 1,
          children: [
            /* @__PURE__ */ jsxDEV4(Box4, {
              marginBottom: 1,
              children: /* @__PURE__ */ jsxDEV4(Text4, {
                color: "red",
                bold: true,
                children: "\u274C Template Download Error:"
              }, undefined, false, undefined, this)
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV4(Text4, {
              color: "red",
              children: downloadError
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV4(Box4, {
              marginTop: 1,
              children: /* @__PURE__ */ jsxDEV4(Text4, {
                color: "gray",
                children: "Press Enter to exit."
              }, undefined, false, undefined, this)
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV4(Fragment, {
          children: [
            currentStep === "TYPE" && /* @__PURE__ */ jsxDEV4(Box4, {
              flexDirection: "column",
              children: [
                /* @__PURE__ */ jsxDEV4(Text4, {
                  color: "gray",
                  children: "Use arrow keys (\u2191/\u2193) to select, press Enter to continue:"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4(Select, {
                  items: projectTypes,
                  onSelect: (item) => {
                    setType(item.value);
                    const selected = templates.find((t) => t.id === item.value);
                    if (selected && isGitUrl(selected.path)) {
                      setIsDownloading(true);
                    } else {
                      handleNext();
                    }
                  }
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            currentStep === "NAME" && /* @__PURE__ */ jsxDEV4(Box4, {
              flexDirection: "column",
              children: [
                /* @__PURE__ */ jsxDEV4(Text4, {
                  color: "gray",
                  children: [
                    "Enter project name / directory name (default: my-",
                    type || "ms",
                    "-project):"
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV4(Box4, {
                  marginY: 1,
                  children: /* @__PURE__ */ jsxDEV4(TextInput, {
                    value: projectName,
                    placeholder: `my-${type || "ms"}-project`,
                    onChange: setProjectName,
                    onSubmit: (val) => {
                      const finalName = val.trim() || `my-${type || "ms"}-project`;
                      setProjectName(finalName);
                      handleNext();
                    }
                  }, undefined, false, undefined, this)
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            currentStep === "PATH" && /* @__PURE__ */ jsxDEV4(Box4, {
              flexDirection: "column",
              children: [
                /* @__PURE__ */ jsxDEV4(Text4, {
                  color: "gray",
                  children: "Enter target installation path (default: current directory './'):"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4(Box4, {
                  marginY: 1,
                  children: /* @__PURE__ */ jsxDEV4(TextInput, {
                    value: targetPath,
                    placeholder: "./",
                    onChange: setTargetPath,
                    onSubmit: (val) => {
                      const finalPath = val.trim() || "./";
                      setTargetPath(finalPath);
                      handleNext();
                    }
                  }, undefined, false, undefined, this)
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            currentStep === "DESCRIPTION" && /* @__PURE__ */ jsxDEV4(Box4, {
              flexDirection: "column",
              children: [
                /* @__PURE__ */ jsxDEV4(Text4, {
                  color: "gray",
                  children: "Enter project description (optional):"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4(Box4, {
                  marginY: 1,
                  children: /* @__PURE__ */ jsxDEV4(TextInput, {
                    value: description,
                    placeholder: "My service/library description",
                    onChange: setDescription,
                    onSubmit: handleNext
                  }, undefined, false, undefined, this)
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            currentStep === "AUTHOR" && /* @__PURE__ */ jsxDEV4(Box4, {
              flexDirection: "column",
              children: [
                /* @__PURE__ */ jsxDEV4(Text4, {
                  color: "gray",
                  children: "Enter author name (optional):"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4(Box4, {
                  marginY: 1,
                  children: /* @__PURE__ */ jsxDEV4(TextInput, {
                    value: author,
                    placeholder: "Developer",
                    onChange: setAuthor,
                    onSubmit: handleNext
                  }, undefined, false, undefined, this)
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            currentStep?.startsWith("PROMPT_") && (() => {
              const promptName = currentStep.replace("PROMPT_", "");
              const promptObj = customPrompts.find((p) => p.name === promptName);
              if (!promptObj)
                return null;
              return /* @__PURE__ */ jsxDEV4(Box4, {
                flexDirection: "column",
                children: [
                  /* @__PURE__ */ jsxDEV4(Text4, {
                    color: "gray",
                    children: [
                      promptObj.message,
                      " (default: ",
                      String(promptObj.default),
                      "):"
                    ]
                  }, undefined, true, undefined, this),
                  /* @__PURE__ */ jsxDEV4(Box4, {
                    marginY: 1,
                    children: /* @__PURE__ */ jsxDEV4(TextInput, {
                      value: String(promptsState[promptName] ?? ""),
                      placeholder: String(promptObj.default),
                      onChange: (val) => {
                        setPromptsState((prev) => ({ ...prev, [promptName]: val }));
                      },
                      onSubmit: (val) => {
                        const finalVal = val.trim() || String(promptObj.default);
                        setPromptsState((prev) => ({ ...prev, [promptName]: finalVal }));
                        handleNext();
                      }
                    }, undefined, false, undefined, this)
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this);
            })(),
            currentStep === "GIT" && /* @__PURE__ */ jsxDEV4(Box4, {
              flexDirection: "column",
              children: [
                /* @__PURE__ */ jsxDEV4(Text4, {
                  color: "gray",
                  children: "Do you want to initialize a Git repository? (Use left/right arrows to toggle, Enter to confirm)"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4(Toggle, {
                  value: git,
                  onChange: setGit,
                  onSubmit: handleNext
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            currentStep === "INSTALL" && /* @__PURE__ */ jsxDEV4(Box4, {
              flexDirection: "column",
              children: [
                /* @__PURE__ */ jsxDEV4(Text4, {
                  color: "gray",
                  children: "Do you want to install dependencies automatically?"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4(Toggle, {
                  value: install,
                  onChange: setInstall,
                  onSubmit: handleNext
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            currentStep === "CONFIRM" && /* @__PURE__ */ jsxDEV4(Box4, {
              flexDirection: "column",
              borderStyle: "single",
              borderColor: "cyan",
              padding: 1,
              children: [
                /* @__PURE__ */ jsxDEV4(Box4, {
                  marginBottom: 1,
                  children: /* @__PURE__ */ jsxDEV4(Text4, {
                    color: "cyan",
                    bold: true,
                    children: "Configuration Summary:"
                  }, undefined, false, undefined, this)
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4(Text4, {
                  children: [
                    "Type:",
                    " ",
                    /* @__PURE__ */ jsxDEV4(Text4, {
                      color: "violet",
                      bold: true,
                      children: type
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV4(Text4, {
                  children: [
                    "Name:",
                    " ",
                    /* @__PURE__ */ jsxDEV4(Text4, {
                      color: "violet",
                      bold: true,
                      children: projectName || `my-${type}-project`
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV4(Text4, {
                  children: [
                    "Target Path: ",
                    /* @__PURE__ */ jsxDEV4(Text4, {
                      color: "violet",
                      children: targetPath || "./"
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV4(Text4, {
                  children: [
                    "Description: ",
                    /* @__PURE__ */ jsxDEV4(Text4, {
                      color: "violet",
                      children: description || "(none)"
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV4(Text4, {
                  children: [
                    "Author: ",
                    /* @__PURE__ */ jsxDEV4(Text4, {
                      color: "violet",
                      children: author || "(none)"
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this),
                customPrompts.map((p) => /* @__PURE__ */ jsxDEV4(Text4, {
                  children: [
                    p.name,
                    ": ",
                    /* @__PURE__ */ jsxDEV4(Text4, {
                      color: "violet",
                      children: String(promptsState[p.name] ?? p.default)
                    }, undefined, false, undefined, this)
                  ]
                }, p.name, true, undefined, this)),
                /* @__PURE__ */ jsxDEV4(Text4, {
                  children: [
                    "Git Init: ",
                    /* @__PURE__ */ jsxDEV4(Text4, {
                      color: "violet",
                      children: git ? "Yes" : "No"
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV4(Text4, {
                  children: [
                    "Install: ",
                    /* @__PURE__ */ jsxDEV4(Text4, {
                      color: "violet",
                      children: install ? "Yes" : "No"
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV4(Box4, {
                  marginTop: 1,
                  children: /* @__PURE__ */ jsxDEV4(Text4, {
                    color: "green",
                    bold: true,
                    children: "Press Enter to generate, or Esc to exit."
                  }, undefined, false, undefined, this)
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            currentStep === "GENERATING" && /* @__PURE__ */ jsxDEV4(Box4, {
              flexDirection: "column",
              children: errorMessage ? /* @__PURE__ */ jsxDEV4(Box4, {
                flexDirection: "column",
                borderStyle: "double",
                borderColor: "red",
                padding: 1,
                children: [
                  /* @__PURE__ */ jsxDEV4(Box4, {
                    marginBottom: 1,
                    children: /* @__PURE__ */ jsxDEV4(Text4, {
                      color: "red",
                      bold: true,
                      children: "\u274C Scaffolding Error:"
                    }, undefined, false, undefined, this)
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV4(Text4, {
                    color: "red",
                    children: errorMessage
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV4(Box4, {
                    marginTop: 1,
                    children: /* @__PURE__ */ jsxDEV4(Text4, {
                      color: "gray",
                      children: "Press Enter to exit."
                    }, undefined, false, undefined, this)
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV4(Box4, {
                flexDirection: "column",
                children: [
                  /* @__PURE__ */ jsxDEV4(Box4, {
                    marginBottom: 1,
                    children: /* @__PURE__ */ jsxDEV4(Text4, {
                      color: "cyan",
                      bold: true,
                      children: "Generating Scaffold..."
                    }, undefined, false, undefined, this)
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV4(Box4, {
                    children: /* @__PURE__ */ jsxDEV4(Text4, {
                      color: getStatusColor(filesStatus),
                      children: [
                        getStatusSymbol(filesStatus),
                        " Generating files..."
                      ]
                    }, undefined, true, undefined, this)
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV4(Box4, {
                    children: /* @__PURE__ */ jsxDEV4(Text4, {
                      color: getStatusColor(hooksStatus),
                      children: [
                        getStatusSymbol(hooksStatus),
                        " Running post-scaffold hooks..."
                      ]
                    }, undefined, true, undefined, this)
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV4(Box4, {
                    children: /* @__PURE__ */ jsxDEV4(Text4, {
                      color: getStatusColor(gitStatus),
                      children: [
                        getStatusSymbol(gitStatus),
                        " Initializing git repository..."
                      ]
                    }, undefined, true, undefined, this)
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV4(Box4, {
                    children: /* @__PURE__ */ jsxDEV4(Text4, {
                      color: getStatusColor(installStatus),
                      children: [
                        getStatusSymbol(installStatus),
                        " Installing dependencies..."
                      ]
                    }, undefined, true, undefined, this)
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this)
            }, undefined, false, undefined, this),
            currentStep === "SUCCESS" && /* @__PURE__ */ jsxDEV4(Box4, {
              flexDirection: "column",
              padding: 1,
              borderStyle: "round",
              borderColor: "green",
              children: [
                /* @__PURE__ */ jsxDEV4(Text4, {
                  color: "green",
                  bold: true,
                  children: "\u2714 Success! Project scaffolded successfully."
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4(Box4, {
                  marginTop: 1,
                  children: /* @__PURE__ */ jsxDEV4(Text4, {
                    children: [
                      "Your project",
                      " ",
                      /* @__PURE__ */ jsxDEV4(Text4, {
                        color: "cyan",
                        bold: true,
                        children: projectName || `my-${type}-project`
                      }, undefined, false, undefined, this),
                      " ",
                      "has been created."
                    ]
                  }, undefined, true, undefined, this)
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4(Box4, {
                  marginTop: 1,
                  children: /* @__PURE__ */ jsxDEV4(Text4, {
                    bold: true,
                    children: "Next steps:"
                  }, undefined, false, undefined, this)
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4(Text4, {
                  color: "violet",
                  children: [
                    " cd ",
                    projectName || `my-${type}-project`
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV4(Text4, {
                  color: "violet",
                  children: " bun dev"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV4(Box4, {
                  marginTop: 1,
                  children: [
                    /* @__PURE__ */ jsxDEV4(Text4, {
                      color: "gray",
                      children: "Documentation: "
                    }, undefined, false, undefined, this),
                    /* @__PURE__ */ jsxDEV4(Link, {
                      url: "https://sierra-creative-labs.github.io/scl-cli",
                      children: /* @__PURE__ */ jsxDEV4(Text4, {
                        color: "cyan",
                        underline: true,
                        children: "sierra-creative-labs.github.io/scl-cli"
                      }, undefined, false, undefined, this)
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV4(Box4, {
                  marginTop: 1,
                  children: /* @__PURE__ */ jsxDEV4(Text4, {
                    color: "gray",
                    children: "Press Enter to exit."
                  }, undefined, false, undefined, this)
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
};

// src/commands/create.ts
var createCommand = new Command("create").description("Generate a new project scaffold").argument("[type]", "Template name/alias (e.g. hono-microservice) or a Git repository URL").argument("[project-name]", "Name of the project directory").argument("[target-path]", "Directory where the project folder will be created (default: current directory)").option("-d, --description <desc>", "Project description").option("-a, --author <name>", "Author name").option("-g, --git", "Initialize a Git repository", true).option("--no-git", "Disable Git repository initialization").option("-i, --install", "Install dependencies automatically", true).option("--no-install", "Skip dependency installation").option("-y, --yes", "Skip interactive prompts (requires type to be provided)", false).option("--interactive", "Force interactive mode", false).option("--var <key=value>", "Custom template variables (can be specified multiple times)", (val, memo) => {
  memo.push(val);
  return memo;
}, []).action(async (type, projectName, targetPath, options) => {
  let templates = resolveTemplates();
  let templateType = type;
  if (type && !isGitUrl(type) && !templates.some((t) => t.id === type)) {
    const registryMatch = TEMPLATE_REGISTRY.find((r) => r.id === type);
    if (registryMatch) {
      console.log(`\uD83D\uDCE5 Registry alias "${type}" matches remote template: ${registryMatch.gitUrl}`);
      type = registryMatch.gitUrl;
    }
  }
  if (type && isGitUrl(type)) {
    console.log(`\uD83D\uDCE5 Cloning/updating remote git template: ${type}...`);
    try {
      const cachedPath = await downloadGitTemplate(type);
      const templateInfo = loadTemplateFromPath(cachedPath);
      templateType = templateInfo.id;
      templates = resolveTemplates();
      console.log(`\u2713 Template loaded: "${templateInfo.name}" (${templateInfo.id})`);
    } catch (err) {
      console.error(`\u274C Failed to download git template: ${String(err)}`);
      process.exit(1);
    }
  }
  if (templateType) {
    const template = templates.find((t) => t.id === templateType);
    if (!template) {
      console.error(`Error: Unknown project type "${templateType}".`);
      console.error("Available types:");
      for (const t of templates) {
        console.error(`  - ${t.id} (${t.name}): ${t.description}`);
      }
      process.exit(1);
    }
  }
  const customVariables = {};
  if (options.var) {
    for (const pair of options.var) {
      const index = pair.indexOf("=");
      if (index !== -1) {
        const key = pair.slice(0, index).trim();
        const val = pair.slice(index + 1).trim();
        customVariables[key] = val;
      }
    }
  }
  if (options.yes && !templateType) {
    console.error("Error: Project type is required when running in non-interactive mode (--yes).");
    process.exit(1);
  }
  const isInteractive = !options.yes;
  if (isInteractive) {
    if (!process.stdin.isTTY) {
      console.error("\u26A0\uFE0F  Interactive TUI mode is not supported in this terminal environment (non-TTY).");
      console.error("Please specify the project type and use the non-interactive flags instead.");
      console.error("Example: bun run dev create ms my-project --yes");
      process.exit(1);
    }
    const templatesList = templates.map((t) => ({
      value: t.id,
      label: t.name,
      description: t.description
    }));
    const { waitUntilExit } = render(React3.createElement(InteractiveApp, {
      initialType: templateType,
      initialProjectName: projectName,
      initialTargetPath: targetPath,
      initialDescription: options.description,
      initialAuthor: options.author,
      initialGit: options.git,
      initialInstall: options.install,
      templatesList,
      customVariables
    }));
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
        customVariables
      });
    } catch (err) {
      console.error(`\u274C Scaffolding failed: ${String(err)}`);
      process.exit(1);
    }
  }
});

// src/index.ts
var program = new Command2;
program.name("scl-cli").description("A high-performance, developer-friendly CLI for project generation and scaffolding.").version("0.0.1");
program.addCommand(createCommand);
program.parse(process.argv);

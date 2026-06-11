import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import Link from 'ink-link';
import { TextInput } from '../components/TextInput';
import { Select } from '../components/Select';
import type { SelectItem } from '../components/Select';
import { Toggle } from '../components/Toggle';

export interface InteractiveAppProps {
  initialType?: string;
  initialProjectName?: string;
  initialDescription?: string;
  initialAuthor?: string;
  initialGit?: boolean;
  initialInstall?: boolean;
}

type Step = 'TYPE' | 'NAME' | 'DESCRIPTION' | 'AUTHOR' | 'GIT' | 'INSTALL' | 'CONFIRM' | 'GENERATING' | 'SUCCESS';

export const InteractiveApp: React.FC<InteractiveAppProps> = ({
  initialType = '',
  initialProjectName = '',
  initialDescription = '',
  initialAuthor = '',
  initialGit = true,
  initialInstall = true,
}) => {
  const { exit } = useApp();

  const [type, setType] = useState(initialType);
  const [projectName, setProjectName] = useState(initialProjectName);
  const [description, setDescription] = useState(initialDescription);
  const [author, setAuthor] = useState(initialAuthor);
  const [git, setGit] = useState(initialGit);
  const [install, setInstall] = useState(initialInstall);

  // Setup the list of steps to show
  const steps: Step[] = [];
  if (!initialType) steps.push('TYPE');
  if (!initialProjectName) steps.push('NAME');
  if (!initialDescription) steps.push('DESCRIPTION');
  if (!initialAuthor) steps.push('AUTHOR');
  steps.push('GIT');
  steps.push('INSTALL');
  steps.push('CONFIRM');
  steps.push('GENERATING');
  steps.push('SUCCESS');

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = steps[currentStepIndex];

  // 0: idle, 1: files generated, 2: hooks run, 3: git init run, 4: install run
  const [progressStep, setProgressStep] = useState(0);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev: number) => prev + 1);
    }
  };

  // Run generation simulation when entering GENERATING step
  useEffect(() => {
    if (currentStep === 'GENERATING') {
      const runSimulation = async () => {
        // Step 1: Generate files
        await new Promise((r) => setTimeout(r, 800));
        setProgressStep(1);

        // Step 2: Post scaffold hooks
        await new Promise((r) => setTimeout(r, 600));
        setProgressStep(2);

        // Step 3: Git init
        if (git) {
          await new Promise((r) => setTimeout(r, 600));
        }
        setProgressStep(3);

        // Step 4: Install dependencies
        if (install) {
          await new Promise((r) => setTimeout(r, 1200));
        }
        setProgressStep(4);

        // Transition to success
        handleNext();
      };
      runSimulation();
    }
  }, [currentStep]);

  // Global shortcuts for Confirm & Success steps
  useInput((input, key) => {
    if (key.escape) {
      exit();
      return;
    }
    if (currentStep === 'CONFIRM' && key.return) {
      handleNext();
    }
    if (currentStep === 'SUCCESS' && key.return) {
      exit();
    }
  });

  const projectTypes: SelectItem[] = [
    { label: 'Microservice (ms) - Bun, Elysia, and Docker', value: 'ms' },
    { label: 'TypeScript Library (lib) - Minimal configuration', value: 'lib' },
  ];

  return (
    <Box flexDirection="column" margin={1}>
      {/* Header Banner */}
      <Box borderStyle="round" borderColor="violet" paddingX={2} paddingY={0} marginBottom={1} flexDirection="column">
        <Text color="violet" bold>
          S C L  -  C L I
        </Text>
        <Text color="gray">
          Sierra Creative Labs Scaffolding System
        </Text>
      </Box>

      {/* Step Indicators */}
      {currentStep !== 'GENERATING' && currentStep !== 'SUCCESS' && (
        <Box marginBottom={1}>
          <Text color="violet" bold>Step {currentStepIndex + 1} of {steps.length - 2}: </Text>
          <Text color="white" bold underline>
            {currentStep === 'TYPE' && 'Select Project Type'}
            {currentStep === 'NAME' && 'Enter Project Name'}
            {currentStep === 'DESCRIPTION' && 'Enter Project Description'}
            {currentStep === 'AUTHOR' && 'Enter Author Name'}
            {currentStep === 'GIT' && 'Initialize Git Repository?'}
            {currentStep === 'INSTALL' && 'Install Dependencies?'}
            {currentStep === 'CONFIRM' && 'Confirm Configuration'}
          </Text>
        </Box>
      )}

      {/* Main Interactive Screen */}
      <Box flexDirection="column" minHeight={6}>
        {currentStep === 'TYPE' && (
          <Box flexDirection="column">
            <Text color="gray">Use arrow keys (↑/↓) to select, press Enter to continue:</Text>
            <Select
              items={projectTypes}
              onSelect={(item: SelectItem) => {
                setType(item.value);
                handleNext();
              }}
            />
          </Box>
        )}

        {currentStep === 'NAME' && (
          <Box flexDirection="column">
            <Text color="gray">Enter project name / directory name (default: my-{type || 'ms'}-project):</Text>
            <Box marginY={1}>
              <TextInput
                value={projectName}
                placeholder={`my-${type || 'ms'}-project`}
                onChange={setProjectName}
                onSubmit={(val: string) => {
                  const finalName = val.trim() || `my-${type || 'ms'}-project`;
                  setProjectName(finalName);
                  handleNext();
                }}
              />
            </Box>
          </Box>
        )}

        {currentStep === 'DESCRIPTION' && (
          <Box flexDirection="column">
            <Text color="gray">Enter project description (optional):</Text>
            <Box marginY={1}>
              <TextInput
                value={description}
                placeholder="My service/library description"
                onChange={setDescription}
                onSubmit={handleNext}
              />
            </Box>
          </Box>
        )}

        {currentStep === 'AUTHOR' && (
          <Box flexDirection="column">
            <Text color="gray">Enter author name (optional):</Text>
            <Box marginY={1}>
              <TextInput
                value={author}
                placeholder="Developer"
                onChange={setAuthor}
                onSubmit={handleNext}
              />
            </Box>
          </Box>
        )}

        {currentStep === 'GIT' && (
          <Box flexDirection="column">
            <Text color="gray">Do you want to initialize a Git repository? (Use left/right arrows to toggle, Enter to confirm)</Text>
            <Toggle
              value={git}
              onChange={setGit}
              onSubmit={handleNext}
            />
          </Box>
        )}

        {currentStep === 'INSTALL' && (
          <Box flexDirection="column">
            <Text color="gray">Do you want to install dependencies automatically?</Text>
            <Toggle
              value={install}
              onChange={setInstall}
              onSubmit={handleNext}
            />
          </Box>
        )}

        {currentStep === 'CONFIRM' && (
          <Box flexDirection="column" borderStyle="single" borderColor="cyan" padding={1}>
            <Box marginBottom={1}>
              <Text color="cyan" bold>Configuration Summary:</Text>
            </Box>
            <Text>Type:        <Text color="violet" bold>{type}</Text></Text>
            <Text>Name:        <Text color="violet" bold>{projectName || `my-${type}-project`}</Text></Text>
            <Text>Description: <Text color="violet">{description || '(none)'}</Text></Text>
            <Text>Author:      <Text color="violet">{author || '(none)'}</Text></Text>
            <Text>Git Init:    <Text color="violet">{git ? 'Yes' : 'No'}</Text></Text>
            <Text>Install:     <Text color="violet">{install ? 'Yes' : 'No'}</Text></Text>

            <Box marginTop={1}>
              <Text color="green" bold>Press Enter to generate, or Esc to exit.</Text>
            </Box>
          </Box>
        )}

        {currentStep === 'GENERATING' && (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color="cyan" bold>Generating Scaffold...</Text>
            </Box>
            
            <Box>
              <Text color={progressStep > 0 ? 'green' : 'violet'}>
                {progressStep > 0 ? '✔' : <Spinner type="dots" />} Generating files...
              </Text>
            </Box>
            
            <Box>
              <Text color={progressStep > 1 ? 'green' : progressStep === 1 ? 'violet' : 'gray'}>
                {progressStep > 1 ? '✔' : progressStep === 1 ? <Spinner type="dots" /> : '◌'} Running post-scaffold hooks...
              </Text>
            </Box>

            <Box>
              <Text color={progressStep > 2 ? 'green' : progressStep === 2 ? 'violet' : 'gray'}>
                {progressStep > 2 ? (git ? '✔' : '🇸') : progressStep === 2 ? <Spinner type="dots" /> : '◌'} Initializing git repository...
              </Text>
            </Box>

            <Box>
              <Text color={progressStep > 3 ? 'green' : progressStep === 3 ? 'violet' : 'gray'}>
                {progressStep > 3 ? (install ? '✔' : '🇸') : progressStep === 3 ? <Spinner type="dots" /> : '◌'} Installing dependencies...
              </Text>
            </Box>
          </Box>
        )}

        {currentStep === 'SUCCESS' && (
          <Box flexDirection="column" padding={1} borderStyle="round" borderColor="green">
            <Text color="green" bold>✔ Success! Project scaffolded successfully.</Text>
            <Box marginTop={1}>
              <Text>Your project <Text color="cyan" bold>{projectName || `my-${type}-project`}</Text> has been created.</Text>
            </Box>
            <Box marginTop={1}>
              <Text bold>Next steps:</Text>
            </Box>
            <Text color="violet">  cd {projectName || `my-${type}-project`}</Text>
            <Text color="violet">  bun dev</Text>

            <Box marginTop={1}>
              <Text color="gray">Documentation: </Text>
              <Link url="https://sierra-creative-labs.github.io/scl-cli">
                <Text color="cyan" underline>sierra-creative-labs.github.io/scl-cli</Text>
              </Link>
            </Box>
            
            <Box marginTop={1}>
              <Text color="gray">Press Enter to exit.</Text>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

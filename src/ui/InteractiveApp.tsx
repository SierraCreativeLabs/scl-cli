import React, { useEffect, useState } from 'react';

import { Box, Text, useApp, useInput } from 'ink';

import Link from 'ink-link';
import Spinner from 'ink-spinner';

import { Select } from '../components/Select';
import type { SelectItem } from '../components/Select';
import { TextInput } from '../components/TextInput';
import { Toggle } from '../components/Toggle';
import { runScaffold } from '../services/scaffold';

export interface InteractiveAppProps {
  initialType?: string;
  initialProjectName?: string;
  initialTargetPath?: string;
  initialDescription?: string;
  initialAuthor?: string;
  initialGit?: boolean;
  initialInstall?: boolean;
  templatesList: { value: string; label: string; description: string }[];
}

type Step =
  | 'TYPE'
  | 'NAME'
  | 'PATH'
  | 'DESCRIPTION'
  | 'AUTHOR'
  | 'GIT'
  | 'INSTALL'
  | 'CONFIRM'
  | 'GENERATING'
  | 'SUCCESS';

export const InteractiveApp: React.FC<InteractiveAppProps> = ({
  initialType = '',
  initialProjectName = '',
  initialTargetPath = '',
  initialDescription = '',
  initialAuthor = '',
  initialGit = true,
  initialInstall = true,
  templatesList,
}) => {
  const { exit } = useApp();

  const [type, setType] = useState(initialType);
  const [projectName, setProjectName] = useState(initialProjectName);
  const [targetPath, setTargetPath] = useState(initialTargetPath);
  const [description, setDescription] = useState(initialDescription);
  const [author, setAuthor] = useState(initialAuthor);
  const [git, setGit] = useState(initialGit);
  const [install, setInstall] = useState(initialInstall);

  const [filesStatus, setFilesStatus] = useState<'pending' | 'active' | 'success' | 'error'>('pending');
  const [hooksStatus, setHooksStatus] = useState<'pending' | 'active' | 'success' | 'error'>('pending');
  const [gitStatus, setGitStatus] = useState<'pending' | 'active' | 'success' | 'skip' | 'error'>('pending');
  const [installStatus, setInstallStatus] = useState<'pending' | 'active' | 'success' | 'skip' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState('');

  // Setup the list of steps to show
  const steps: Step[] = [];
  if (!initialType) steps.push('TYPE');
  if (!initialProjectName) steps.push('NAME');
  if (!initialTargetPath) steps.push('PATH');
  if (!initialDescription) steps.push('DESCRIPTION');
  if (!initialAuthor) steps.push('AUTHOR');
  steps.push('GIT');
  steps.push('INSTALL');
  steps.push('CONFIRM');
  steps.push('GENERATING');
  steps.push('SUCCESS');

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = steps[currentStepIndex];

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev: number) => prev + 1);
    }
  };

  // Run scaffolding when entering GENERATING step
  useEffect(() => {
    if (currentStep === 'GENERATING') {
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
            onProgress: (step, status) => {
              if (step === 'files' && status !== 'skip') setFilesStatus(status);
              if (step === 'hooks' && status !== 'skip') setHooksStatus(status);
              if (step === 'git') setGitStatus(status);
              if (step === 'install') setInstallStatus(status);
            },
          });
          handleNext();
        } catch (err) {
          setErrorMessage(String(err));
        }
      };
      void executeScaffold();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // Global shortcuts for Confirm, Error, & Success steps
  useInput((input, key) => {
    if (key.escape) {
      exit();
      return;
    }
    if (errorMessage && key.return) {
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

  const projectTypes: SelectItem[] = templatesList.map(t => ({
    label: `${t.label} (${t.value})`,
    value: t.value,
  }));

  const getStatusColor = (status: string) => {
    if (status === 'success') return 'green';
    if (status === 'active') return 'violet';
    if (status === 'skip') return 'gray';
    if (status === 'error') return 'red';
    return 'gray';
  };

  const getStatusSymbol = (status: string) => {
    if (status === 'success') return '✔';
    if (status === 'active') return <Spinner type="dots" />;
    if (status === 'skip') return '🇸';
    if (status === 'error') return '✖';
    return '◌';
  };

  return (
    <Box flexDirection="column" margin={1}>
      {/* Header Banner */}
      <Box borderStyle="round" borderColor="violet" paddingX={2} paddingY={0} marginBottom={1} flexDirection="column">
        <Text color="violet" bold>
          S C L - C L I
        </Text>
        <Text color="gray">Sierra Creative Labs Scaffolding System</Text>
      </Box>

      {/* Step Indicators */}
      {currentStep !== 'GENERATING' && currentStep !== 'SUCCESS' && (
        <Box marginBottom={1}>
          <Text color="violet" bold>
            Step {currentStepIndex + 1} of {steps.length - 2}:{' '}
          </Text>
          <Text color="white" bold underline>
            {currentStep === 'TYPE' && 'Select Project Type'}
            {currentStep === 'NAME' && 'Enter Project Name'}
            {currentStep === 'PATH' && 'Enter Installation Path'}
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

        {currentStep === 'PATH' && (
          <Box flexDirection="column">
            <Text color="gray">{"Enter target installation path (default: current directory './'):"}</Text>
            <Box marginY={1}>
              <TextInput
                value={targetPath}
                placeholder="./"
                onChange={setTargetPath}
                onSubmit={(val: string) => {
                  const finalPath = val.trim() || './';
                  setTargetPath(finalPath);
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
              <TextInput value={author} placeholder="Developer" onChange={setAuthor} onSubmit={handleNext} />
            </Box>
          </Box>
        )}

        {currentStep === 'GIT' && (
          <Box flexDirection="column">
            <Text color="gray">
              Do you want to initialize a Git repository? (Use left/right arrows to toggle, Enter to confirm)
            </Text>
            <Toggle value={git} onChange={setGit} onSubmit={handleNext} />
          </Box>
        )}

        {currentStep === 'INSTALL' && (
          <Box flexDirection="column">
            <Text color="gray">Do you want to install dependencies automatically?</Text>
            <Toggle value={install} onChange={setInstall} onSubmit={handleNext} />
          </Box>
        )}

        {currentStep === 'CONFIRM' && (
          <Box flexDirection="column" borderStyle="single" borderColor="cyan" padding={1}>
            <Box marginBottom={1}>
              <Text color="cyan" bold>
                Configuration Summary:
              </Text>
            </Box>
            <Text>
              Type:{' '}
              <Text color="violet" bold>
                {type}
              </Text>
            </Text>
            <Text>
              Name:{' '}
              <Text color="violet" bold>
                {projectName || `my-${type}-project`}
              </Text>
            </Text>
            <Text>
              Target Path: <Text color="violet">{targetPath || './'}</Text>
            </Text>
            <Text>
              Description: <Text color="violet">{description || '(none)'}</Text>
            </Text>
            <Text>
              Author: <Text color="violet">{author || '(none)'}</Text>
            </Text>
            <Text>
              Git Init: <Text color="violet">{git ? 'Yes' : 'No'}</Text>
            </Text>
            <Text>
              Install: <Text color="violet">{install ? 'Yes' : 'No'}</Text>
            </Text>

            <Box marginTop={1}>
              <Text color="green" bold>
                Press Enter to generate, or Esc to exit.
              </Text>
            </Box>
          </Box>
        )}

        {currentStep === 'GENERATING' && (
          <Box flexDirection="column">
            {errorMessage ? (
              <Box flexDirection="column" borderStyle="double" borderColor="red" padding={1}>
                <Box marginBottom={1}>
                  <Text color="red" bold>
                    ❌ Scaffolding Error:
                  </Text>
                </Box>
                <Text color="red">{errorMessage}</Text>
                <Box marginTop={1}>
                  <Text color="gray">Press Enter to exit.</Text>
                </Box>
              </Box>
            ) : (
              <Box flexDirection="column">
                <Box marginBottom={1}>
                  <Text color="cyan" bold>
                    Generating Scaffold...
                  </Text>
                </Box>

                <Box>
                  <Text color={getStatusColor(filesStatus)}>{getStatusSymbol(filesStatus)} Generating files...</Text>
                </Box>

                <Box>
                  <Text color={getStatusColor(hooksStatus)}>
                    {getStatusSymbol(hooksStatus)} Running post-scaffold hooks...
                  </Text>
                </Box>

                <Box>
                  <Text color={getStatusColor(gitStatus)}>
                    {getStatusSymbol(gitStatus)} Initializing git repository...
                  </Text>
                </Box>

                <Box>
                  <Text color={getStatusColor(installStatus)}>
                    {getStatusSymbol(installStatus)} Installing dependencies...
                  </Text>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {currentStep === 'SUCCESS' && (
          <Box flexDirection="column" padding={1} borderStyle="round" borderColor="green">
            <Text color="green" bold>
              ✔ Success! Project scaffolded successfully.
            </Text>
            <Box marginTop={1}>
              <Text>
                Your project{' '}
                <Text color="cyan" bold>
                  {projectName || `my-${type}-project`}
                </Text>{' '}
                has been created.
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text bold>Next steps:</Text>
            </Box>
            <Text color="violet"> cd {projectName || `my-${type}-project`}</Text>
            <Text color="violet"> bun dev</Text>

            <Box marginTop={1}>
              <Text color="gray">Documentation: </Text>
              <Link url="https://sierra-creative-labs.github.io/scl-cli">
                <Text color="cyan" underline>
                  sierra-creative-labs.github.io/scl-cli
                </Text>
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

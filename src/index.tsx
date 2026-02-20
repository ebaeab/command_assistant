#!/usr/bin/env node
import React, { useState, useRef, useEffect } from 'react';
import { render, Box, Text, useInput, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { useAppStore } from './store.js';
import { CommandExecutor } from './executor.js';

const executor = new CommandExecutor();

const TabBar = () => {
  const { activeTab, setActiveTab } = useAppStore();
  const tabs = ['input', 'buttons', 'history'] as const;
  const tabLabels: Record<string, string> = {
    input: '输入',
    buttons: '常用命令',
    history: '历史'
  };

  useInput((input, key) => {
    if (key.tab) {
      const currentIndex = tabs.indexOf(activeTab);
      const nextIndex = (currentIndex + 1) % tabs.length;
      setActiveTab(tabs[nextIndex]);
    }
    if (input === '1') setActiveTab('input');
    if (input === '2') setActiveTab('buttons');
    if (input === '3') setActiveTab('history');
  });

  return (
    <Box borderStyle="round" paddingX={1} height={3}>
      {tabs.map((tab, i) => (
        <Box key={tab} marginRight={i < tabs.length - 1 ? 2 : 0}>
          <Text bold={activeTab === tab} color={activeTab === tab ? 'green' : 'gray'}>
            {activeTab === tab ? '› ' : `[${i + 1}] `}{tabLabels[tab]}
            {activeTab === tab ? ' ‹' : ''}
          </Text>
        </Box>
      ))}
      <Box flexGrow={1} justifyContent="flex-end">
        <Text color="gray">Tab/1-3: switch | Ctrl+C: exit</Text>
      </Box>
    </Box>
  );
};

const OutputPanel = () => {
  const { currentOutput } = useAppStore();
  const scrollRef = useRef(0);
  const prevOutputRef = useRef('');
  const lines = currentOutput.split('\n');
  const maxVisible = 16;

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (currentOutput !== prevOutputRef.current) {
      scrollRef.current = Math.max(0, lines.length - maxVisible);
      prevOutputRef.current = currentOutput;
    }
  }, [currentOutput, lines.length]);

  useInput((input, key) => {
    if (key.pageUp) {
      scrollRef.current = Math.max(0, scrollRef.current - 5);
    }
    if (key.pageDown) {
      scrollRef.current = Math.min(
        Math.max(0, lines.length - maxVisible),
        scrollRef.current + 5
      );
    }
  });

  const visibleLines = lines.slice(scrollRef.current, scrollRef.current + maxVisible);

  return (
    <Box borderStyle="round" flexDirection="column" height={20} paddingX={1}>
      <Box borderBottom>
        <Text bold color="blue">输出</Text>
        {lines.length > maxVisible && (
          <Box marginLeft={1}>
            <Text color="gray">
              (PgUp/PgDn to scroll, {lines.length} lines)
            </Text>
          </Box>
        )}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {visibleLines.map((line, i) => (
          <Text key={i} wrap="truncate">{line || ' '}</Text>
        ))}
      </Box>
    </Box>
  );
};

const InputPanel = () => {
  const { currentCommand, setCurrentCommand, appendOutput, setCurrentOutput, setIsRunning, addHistoryItem } = useAppStore();
  const [isFocused, setIsFocused] = useState(true);

  const runCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    setIsFocused(false);
    setIsRunning(true);
    setCurrentOutput('');
    appendOutput(`$ ${cmd}\n`);

    const startTime = Date.now();
    const result = await executor.execute(
      cmd,
      (data) => appendOutput(data),
      (data) => appendOutput(data)
    );

    const duration = Date.now() - startTime;
    appendOutput(`\n✓ Done in ${duration}ms (exit code: ${result.exitCode})\n`);

    addHistoryItem({
      id: Date.now().toString(),
      command: cmd,
      timestamp: Date.now(),
      output: result.output,
      success: result.success,
    });

    setIsRunning(false);
    setIsFocused(true);
    setCurrentCommand('');
  };

  const { isRawModeSupported } = useStdin();

  return (
    <Box borderStyle="round" flexDirection="column" paddingX={1} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="blue">命令输入</Text>
        <Box marginLeft={1}>
          <Text color="gray">(Enter to run)</Text>
        </Box>
      </Box>
      <Box>
        <Text bold>$ </Text>
        {isFocused && isRawModeSupported ? (
          <TextInput
            value={currentCommand}
            onChange={setCurrentCommand}
            onSubmit={runCommand}
            placeholder="Type command..."
          />
        ) : (
          <Text color="gray">{currentCommand || '...'}</Text>
        )}
      </Box>
    </Box>
  );
};

const ButtonsPanel = () => {
  const { buttonCommands, appendOutput, setCurrentOutput, setIsRunning, addHistoryItem, removeButtonCommand } = useAppStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { activeTab } = useAppStore();

  const runCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    setIsRunning(true);
    setCurrentOutput('');
    appendOutput(`$ ${cmd}\n`);

    const startTime = Date.now();
    const result = await executor.execute(
      cmd,
      (data) => appendOutput(data),
      (data) => appendOutput(data)
    );

    const duration = Date.now() - startTime;
    appendOutput(`\n✓ Done in ${duration}ms (exit code: ${result.exitCode})\n`);

    addHistoryItem({
      id: Date.now().toString(),
      command: cmd,
      timestamp: Date.now(),
      output: result.output,
      success: result.success,
    });

    setIsRunning(false);
  };

  useInput((input, key) => {
    if (activeTab !== 'buttons') return;
    if (buttonCommands.length === 0) return;

    if (key.downArrow || input === 'j') {
      setSelectedIndex((i) => (i + 1) % buttonCommands.length);
    }
    if (key.upArrow || input === 'k') {
      setSelectedIndex((i) => (i - 1 + buttonCommands.length) % buttonCommands.length);
    }
    if (key.return) {
      runCommand(buttonCommands[selectedIndex].command);
    }
    if (input === 'd' || input === 'D') {
      const id = buttonCommands[selectedIndex].id;
      removeButtonCommand(id);
      setSelectedIndex((i) => Math.max(0, Math.min(i, buttonCommands.length - 2)));
    }
  });

  return (
    <Box borderStyle="round" flexDirection="column" paddingX={1} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="blue">命令选择</Text>
        <Box marginLeft={1}>
          <Text color="gray">(↑/↓ to select, Enter run, "d" delete)</Text>
        </Box>
      </Box>
      <Box flexDirection="column">
        {buttonCommands.map((btn, i) => (
          <Box key={btn.id}>
            <Text color={i === selectedIndex ? 'green' : 'gray'}>
              {i === selectedIndex ? '› ' : '  '}
            </Text>
            <Text bold={i === selectedIndex} color={i === selectedIndex ? 'green' : undefined}>
              {btn.label}
            </Text>
            <Box marginLeft={1}>
              <Text color="gray">
                - {btn.command}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const HistoryPanel = () => {
  const { history, appendOutput, setCurrentOutput, setIsRunning, addHistoryItem, setCurrentCommand, setActiveTab, buttonCommands, addButtonCommand } = useAppStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollRef = useRef(0);
  const { activeTab } = useAppStore();
  const maxVisible = 10;

  const runCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    setIsRunning(true);
    setCurrentOutput('');
    appendOutput(`$ ${cmd}\n`);

    const startTime = Date.now();
    const result = await executor.execute(
      cmd,
      (data) => appendOutput(data),
      (data) => appendOutput(data)
    );

    const duration = Date.now() - startTime;
    appendOutput(`\n✓ Done in ${duration}ms (exit code: ${result.exitCode})\n`);

    addHistoryItem({
      id: Date.now().toString(),
      command: cmd,
      timestamp: Date.now(),
      output: result.output,
      success: result.success,
    });

    setIsRunning(false);
  };

  const editCommand = (cmd: string) => {
    setCurrentCommand(cmd);
    setActiveTab('input');
  };

  const saveToButtons = (cmd: string) => {
    const exists = buttonCommands.some(b => b.command === cmd);
    if (!exists) {
      addButtonCommand({
        id: Date.now().toString(),
        label: cmd,
        command: cmd
      });
    }
  };

  useInput((input, key) => {
    if (activeTab !== 'history') return;
    if (history.length === 0) return;

    if (key.downArrow || input === 'j') {
      setSelectedIndex((i) => {
        const newIndex = (i + 1) % history.length;
        if (newIndex >= scrollRef.current + maxVisible) {
          scrollRef.current = Math.min(history.length - maxVisible, newIndex - maxVisible + 1);
        }
        return newIndex;
      });
    }
    if (key.upArrow || input === 'k') {
      setSelectedIndex((i) => {
        const newIndex = (i - 1 + history.length) % history.length;
        if (newIndex < scrollRef.current) {
          scrollRef.current = Math.max(0, newIndex);
        }
        return newIndex;
      });
    }
    if (key.return) {
      runCommand(history[selectedIndex].command);
    }
    if (input === 'e') {
      editCommand(history[selectedIndex].command);
    }
    if (input === 's') {
      saveToButtons(history[selectedIndex].command);
    }
  });

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString();
  };

  return (
    <Box borderStyle="round" flexDirection="column" paddingX={1} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="blue">命令历史</Text>
        <Box marginLeft={1}>
          <Text color="gray">(↑/↓ to select, Enter run, "e" edit, "s" save)</Text>
        </Box>
        {history.length > maxVisible && (
          <Box marginLeft={1}>
            <Text color="gray">({history.length} items)</Text>
          </Box>
        )}
      </Box>
      <Box flexDirection="column" height={12}>
        {history.length === 0 ? (
          <Text color="gray">No commands yet...</Text>
        ) : (
          history.slice(scrollRef.current, scrollRef.current + maxVisible).map((item, displayIndex) => {
            const i = scrollRef.current + displayIndex;
            return (
              <Box key={item.id}>
                <Text color={i === selectedIndex ? 'green' : 'gray'}>
                  {i === selectedIndex ? '› ' : '  '}
                </Text>
                <Text color={item.success ? 'green' : 'red'}>
                  {item.success ? '✓' : '✗'}
                </Text>
                <Box marginLeft={1}>
                  <Text color="gray">{formatTime(item.timestamp)}</Text>
                </Box>
                <Box marginLeft={1}>
                  <Text bold={i === selectedIndex} wrap="truncate">
                    {' '}{item.command}
                  </Text>
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
};

const App = () => {
  const { activeTab, isRunning } = useAppStore();

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ════ 命令助手 ════
        </Text>
        {isRunning && (
          <Box marginLeft={2}>
            <Text color="yellow">
              ⟳ Running...
            </Text>
          </Box>
        )}
      </Box>

      <Box>
        <TabBar />
      </Box>

      <Box marginTop={1} flexDirection="column">
        {activeTab === 'input' && <InputPanel />}
        {activeTab === 'buttons' && <ButtonsPanel />}
        {activeTab === 'history' && <HistoryPanel />}
      </Box>

      <Box marginTop={1}>
        <OutputPanel />
      </Box>
    </Box>
  );
};

process.stdout.write('\x1B[2J\x1B[0f');
render(<App />);

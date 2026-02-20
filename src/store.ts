import { create } from 'zustand';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const configDir = path.join(os.homedir(), '.ink-term');
const historyFilePath = path.join(configDir, 'history.json');

export interface CommandHistoryItem {
  id: string;
  command: string;
  timestamp: number;
  output?: string;
  success?: boolean;
}

export interface ButtonCommand {
  id: string;
  label: string;
  command: string;
}

interface SavedState {
  history: CommandHistoryItem[];
  buttonCommands: ButtonCommand[];
}

interface AppState {
  history: CommandHistoryItem[];
  buttonCommands: ButtonCommand[];
  currentOutput: string;
  currentCommand: string;
  isRunning: boolean;
  activeTab: 'input' | 'history' | 'buttons';

  addHistoryItem: (item: CommandHistoryItem) => void;
  clearHistory: () => void;
  setCurrentOutput: (output: string) => void;
  appendOutput: (text: string) => void;
  setCurrentCommand: (command: string) => void;
  setIsRunning: (running: boolean) => void;
  setActiveTab: (tab: 'input' | 'history' | 'buttons') => void;
  addButtonCommand: (btn: ButtonCommand) => void;
  removeButtonCommand: (id: string) => void;
  updateButtonCommand: (id: string, btn: Partial<ButtonCommand>) => void;
}

const defaultButtons: ButtonCommand[] = [
  { id: '1', label: 'adb devices', command: 'adb devices' },
  { id: '2', label: 'ipconfig', command: 'ipconfig' },
];

const ensureConfigDir = () => {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
};

const loadState = (): SavedState | null => {
  try {
    ensureConfigDir();
    if (fs.existsSync(historyFilePath)) {
      const data = fs.readFileSync(historyFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // ignore
  }
  return null;
};

const saveState = (state: SavedState) => {
  try {
    ensureConfigDir();
    const stateToSave = {
      ...state,
      history: state.history.map(item => ({
        ...item,
        output: undefined
      }))
    };
    fs.writeFileSync(historyFilePath, JSON.stringify(stateToSave, null, 2));
  } catch {
    // ignore
  }
};

const saved = loadState();

export const useAppStore = create<AppState>((set, get) => ({
  history: saved?.history ?? [],
  buttonCommands: saved?.buttonCommands ?? defaultButtons,
  currentOutput: '',
  currentCommand: '',
  isRunning: false,
  activeTab: 'input',

  addHistoryItem: (item) => {
    set((state) => {
      const newHistory = [item, ...state.history].slice(0, 100);
      saveState({ history: newHistory, buttonCommands: state.buttonCommands });
      return { history: newHistory };
    });
  },

  clearHistory: () => {
    set((state) => {
      saveState({ history: [], buttonCommands: state.buttonCommands });
      return { history: [] };
    });
  },

  setCurrentOutput: (output) => set({ currentOutput: output }),

  appendOutput: (text) =>
    set((state) => ({ currentOutput: state.currentOutput + text })),

  setCurrentCommand: (command) => set({ currentCommand: command }),

  setIsRunning: (running) => set({ isRunning: running }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  addButtonCommand: (btn) => {
    set((state) => {
      const newButtons = [...state.buttonCommands, btn];
      saveState({ history: state.history, buttonCommands: newButtons });
      return { buttonCommands: newButtons };
    });
  },

  removeButtonCommand: (id) => {
    set((state) => {
      const newButtons = state.buttonCommands.filter((b) => b.id !== id);
      saveState({ history: state.history, buttonCommands: newButtons });
      return { buttonCommands: newButtons };
    });
  },

  updateButtonCommand: (id, btn) => {
    set((state) => {
      const newButtons = state.buttonCommands.map((b) =>
        b.id === id ? { ...b, ...btn } : b
      );
      saveState({ history: state.history, buttonCommands: newButtons });
      return { buttonCommands: newButtons };
    });
  },
}));

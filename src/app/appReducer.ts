import type { Task } from '../types/task'
import type { ArchiveFolder, ArchiveItem } from '../types/archive'

export type AppView = 'home' | 'archive'

export type HomeMode =
  | 'running'
  | 'paused'
  | 'pauseVoiceInput'
  | 'addTaskText'
  | 'addTaskVoice'
  | 'replanning'
  | 'taskDetail'
  | 'taskEditing'
  | 'dailySchedule'

export interface AppState {
  view: AppView
  homeMode: HomeMode
  activeTaskIndex: number
  selectedDate: string
  activeArchiveFolder: string
  tasks: Task[]
  archiveFolders: ArchiveFolder[]
  selectedTaskId: string | null
  taskReturnMode: 'running' | 'dailySchedule'
}

export type AppAction =
  | { type: 'SET_VIEW'; view: AppView }
  | { type: 'SET_HOME_MODE'; mode: HomeMode }
  | { type: 'SET_ACTIVE_TASK'; index: number }
  | { type: 'SET_SELECTED_DATE'; date: string }
  | { type: 'SET_ARCHIVE_FOLDER'; id: string }
  | { type: 'CREATE_ARCHIVE_FOLDER'; folder: ArchiveFolder }
  | { type: 'ADD_ARCHIVE_ITEM'; folderId: string; item: ArchiveItem }
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'OPEN_TASK'; id: string; returnMode?: 'running' | 'dailySchedule' }
  | { type: 'CLOSE_TASK' }
  | { type: 'UPDATE_TASK'; task: Task }
  | { type: 'DELETE_TASK'; id: string }

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, view: action.view }
    case 'SET_HOME_MODE':
      return { ...state, homeMode: action.mode }
    case 'SET_ACTIVE_TASK':
      return { ...state, activeTaskIndex: action.index }
    case 'SET_SELECTED_DATE':
      return { ...state, selectedDate: action.date, activeTaskIndex: 0 }
    case 'SET_ARCHIVE_FOLDER':
      return { ...state, activeArchiveFolder: action.id }
    case 'CREATE_ARCHIVE_FOLDER':
      return { ...state, archiveFolders: [...state.archiveFolders, action.folder], activeArchiveFolder: action.folder.id }
    case 'ADD_ARCHIVE_ITEM':
      return {
        ...state,
        archiveFolders: state.archiveFolders.map((folder) => folder.id === action.folderId
          ? { ...folder, items: [action.item, ...folder.items] }
          : folder),
      }
    case 'ADD_TASK':
      return { ...state, tasks: [action.task, ...state.tasks], activeTaskIndex: 0 }
    case 'OPEN_TASK':
      return { ...state, selectedTaskId: action.id, taskReturnMode: action.returnMode ?? 'running', homeMode: 'taskDetail' }
    case 'CLOSE_TASK':
      return { ...state, selectedTaskId: null, homeMode: state.taskReturnMode }
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((task) => task.id === action.task.id ? action.task : task),
        selectedDate: action.task.date,
        homeMode: 'taskDetail',
      }
    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== action.id),
        selectedTaskId: null,
        activeTaskIndex: 0,
        homeMode: state.taskReturnMode,
      }
  }
}

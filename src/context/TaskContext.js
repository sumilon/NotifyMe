import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { loadTasks, saveTasks, clearAllTasks as clearStorageTasks } from '../utils/storage';
import {
  scheduleNotification,
  cancelNotification,
  cancelAllNotifications,
  requestNotificationPermissions,
} from '../utils/notificationService';
import { generateId } from '../utils/theme';

const TaskContext = createContext(null);

const initialState = { tasks: [], loading: true, permissionsGranted: false };

function taskReducer(state, action) {
  switch (action.type) {
    case 'SET_TASKS':       return { ...state, tasks: action.payload, loading: false };
    case 'SET_LOADING':     return { ...state, loading: action.payload };
    case 'SET_PERMISSIONS': return { ...state, permissionsGranted: action.payload };
    case 'ADD_TASK':        return { ...state, tasks: [...state.tasks, action.payload] };
    case 'UPDATE_TASK':     return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'DELETE_TASK':     return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) };
    case 'CLEAR_TASKS':     return { ...state, tasks: [] };
    default:                return state;
  }
}

export function TaskProvider({ children }) {
  const [state, dispatch] = useReducer(taskReducer, initialState);

  useEffect(() => { initializeApp(); }, []);

  useEffect(() => {
    if (!state.loading) saveTasks(state.tasks);
  }, [state.tasks, state.loading]);

  async function initializeApp() {
    const granted = await requestNotificationPermissions();
    dispatch({ type: 'SET_PERMISSIONS', payload: granted });
    const tasks = await loadTasks();
    dispatch({ type: 'SET_TASKS', payload: tasks });
  }

  const addTask = useCallback(async (taskData) => {
    const id = generateId('task');
    let notificationIds = [];
    if (state.permissionsGranted) {
      try {
        notificationIds = await scheduleNotification({ ...taskData, id });
      } catch (e) { console.error('Schedule error:', e); }
    }
    const newTask = {
      ...taskData, id, notificationIds,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_TASK', payload: newTask });
    return newTask;
  }, [state.permissionsGranted]);

  const updateTask = useCallback(async (taskData) => {
    const existing = state.tasks.find(t => t.id === taskData.id);
    if (existing?.notificationIds?.length) await cancelNotification(existing.notificationIds);
    let notificationIds = [];
    if (state.permissionsGranted && taskData.isActive) {
      try {
        notificationIds = await scheduleNotification(taskData);
      } catch (e) { console.error('Reschedule error:', e); }
    }
    dispatch({ type: 'UPDATE_TASK', payload: { ...taskData, notificationIds } });
  }, [state.tasks, state.permissionsGranted]);

  const deleteTask = useCallback(async (taskId) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (task?.notificationIds?.length) await cancelNotification(task.notificationIds);
    dispatch({ type: 'DELETE_TASK', payload: taskId });
  }, [state.tasks]);

  const clearAllTasks = useCallback(async () => {
    await cancelAllNotifications();
    await clearStorageTasks();
    dispatch({ type: 'CLEAR_TASKS' });
  }, []);

  const toggleTask = useCallback(async (taskId) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.isActive) {
      if (task.notificationIds?.length) await cancelNotification(task.notificationIds);
      dispatch({ type: 'UPDATE_TASK', payload: { ...task, isActive: false, notificationIds: [] } });
    } else {
      let notificationIds = [];
      if (state.permissionsGranted) {
        try { notificationIds = await scheduleNotification({ ...task }); }
        catch (e) { console.error('Toggle reschedule error:', e); }
      }
      dispatch({ type: 'UPDATE_TASK', payload: { ...task, isActive: true, notificationIds } });
    }
  }, [state.tasks, state.permissionsGranted]);

  return (
    <TaskContext.Provider value={{
      tasks: state.tasks,
      loading: state.loading,
      permissionsGranted: state.permissionsGranted,
      addTask, updateTask, deleteTask, toggleTask, clearAllTasks,
    }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be used within TaskProvider');
  return ctx;
}

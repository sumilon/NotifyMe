import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { AppState } from "react-native";
import {
  loadTasks,
  saveTasks,
  clearAllTasks as clearStorageTasks,
} from "../utils/storage";
import {
  scheduleNotification,
  cancelNotification,
  cancelAllNotifications,
  requestNotificationPermissions,
} from "../utils/notificationService";
import { generateId, REPEAT_TYPES } from "../utils/theme";
import { useToast } from "./ToastContext";

const TaskContext = createContext(null);

const initialState = { tasks: [], loading: true, permissionsGranted: false };

function taskReducer(state, action) {
  switch (action.type) {
    case "SET_TASKS":
      return { ...state, tasks: action.payload, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_PERMISSIONS":
      return { ...state, permissionsGranted: action.payload };
    case "ADD_TASK":
      return { ...state, tasks: [...state.tasks, action.payload] };
    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.id ? action.payload : t,
        ),
      };
    case "DELETE_TASK":
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.payload),
      };
    case "CLEAR_TASKS":
      return { ...state, tasks: [] };
    default:
      return state;
  }
}

/**
 * Returns true if a one-time task's fire time has already passed.
 * Used both for auto-deactivation on launch and for "Clear all fired".
 */
function isOneTimeFired(t) {
  if (t.repeatType !== REPEAT_TYPES.ONCE) return false;
  if (t.timeHour === undefined || t.dateYear === undefined) return false;
  // For multi-time tasks, fired only when the LAST slot has passed
  const allSlots = [
    { hour: t.timeHour, minute: t.timeMinute ?? 0 },
    ...(t.additionalTimes || []),
  ];
  const last = allSlots.reduce((a, b) =>
    b.hour * 60 + b.minute > a.hour * 60 + a.minute ? b : a,
  );
  const fireAt = new Date(
    t.dateYear,
    t.dateMonth,
    t.dateDay,
    last.hour,
    last.minute,
    0,
    0,
  );
  return fireAt <= new Date();
}

export function TaskProvider({ children }) {
  const [state, dispatch] = useReducer(taskReducer, initialState);
  const { showToast } = useToast();

  // Mirror state into a ref so AppState listener has access to latest values
  // without needing to re-subscribe on every render.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    initializeApp();
  }, []);

  // Persist tasks on every change. Show a toast if save fails.
  useEffect(() => {
    if (state.loading) return;
    (async () => {
      const ok = await saveTasks(state.tasks);
      if (!ok)
        showToast(
          "error",
          "Save failed",
          "Could not save your changes — storage may be full.",
        );
    })();
  }, [state.tasks, state.loading]);

  // Re-check permissions when app returns to foreground.
  // If permissions were just granted, reschedule any active tasks that
  // missed scheduling because permission was previously denied.
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (nextState !== "active") return;
      const wasGranted = stateRef.current.permissionsGranted;
      const granted = await requestNotificationPermissions();
      if (granted !== wasGranted) {
        dispatch({ type: "SET_PERMISSIONS", payload: granted });
      }
      if (granted && !wasGranted) {
        const tasks = stateRef.current.tasks;
        for (const t of tasks) {
          if (
            t.isActive &&
            (!t.notificationIds || t.notificationIds.length === 0)
          ) {
            try {
              const ids = await scheduleNotification(t);
              dispatch({
                type: "UPDATE_TASK",
                payload: { ...t, notificationIds: ids },
              });
            } catch (e) {
              console.error("Re-schedule on permission grant failed:", e);
            }
          }
        }
      }
    });
    return () => sub.remove();
  }, []);

  async function initializeApp() {
    const granted = await requestNotificationPermissions();
    dispatch({ type: "SET_PERMISSIONS", payload: granted });

    let tasks = await loadTasks();

    // Auto-deactivate one-time tasks whose fire time has passed.
    let changed = false;
    tasks = tasks.map((t) => {
      if (t.isActive && isOneTimeFired(t)) {
        changed = true;
        return { ...t, isActive: false, notificationIds: [] };
      }
      return t;
    });

    dispatch({ type: "SET_TASKS", payload: tasks });
    if (changed) await saveTasks(tasks);
  }

  const addTask = useCallback(
    async (taskData) => {
      const id = generateId("task");
      let notificationIds = [];
      if (state.permissionsGranted) {
        try {
          notificationIds = await scheduleNotification({ ...taskData, id });
        } catch (e) {
          console.error("Schedule error:", e);
        }
      }
      const newTask = {
        ...taskData,
        id,
        notificationIds,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_TASK", payload: newTask });
      return newTask;
    },
    [state.permissionsGranted],
  );

  const updateTask = useCallback(
    async (taskData) => {
      const existing = state.tasks.find((t) => t.id === taskData.id);
      if (existing?.notificationIds?.length)
        await cancelNotification(existing.notificationIds);
      let notificationIds = [];
      if (state.permissionsGranted && taskData.isActive) {
        try {
          notificationIds = await scheduleNotification(taskData);
        } catch (e) {
          console.error("Reschedule error:", e);
        }
      }
      dispatch({
        type: "UPDATE_TASK",
        payload: { ...taskData, notificationIds },
      });
    },
    [state.tasks, state.permissionsGranted],
  );

  const deleteTask = useCallback(
    async (taskId) => {
      const task = state.tasks.find((t) => t.id === taskId);
      if (task?.notificationIds?.length)
        await cancelNotification(task.notificationIds);
      dispatch({ type: "DELETE_TASK", payload: taskId });
    },
    [state.tasks],
  );

  // Clears ALL tasks. Web-safe: cancelAllNotifications swallows web errors.
  const clearAllTasks = useCallback(async () => {
    try {
      await cancelAllNotifications();
    } catch (e) {
      console.warn("cancelAll:", e);
    }
    const ok = await clearStorageTasks();
    dispatch({ type: "CLEAR_TASKS" });
    if (!ok)
      showToast("error", "Clear failed", "Storage error — please try again.");
  }, [showToast]);

  // NEW: Clears only fired one-time reminders. Daily/weekly are preserved.
  const clearFiredTasks = useCallback(async () => {
    const fired = state.tasks.filter(isOneTimeFired);
    const remaining = state.tasks.filter((t) => !isOneTimeFired(t));

    // Defensive: cancel any leftover notifications for fired tasks
    for (const t of fired) {
      if (t.notificationIds?.length) {
        try {
          await cancelNotification(t.notificationIds);
        } catch {
          /* ignore */
        }
      }
    }

    dispatch({ type: "SET_TASKS", payload: remaining });
  }, [state.tasks]);

  const toggleTask = useCallback(
    async (taskId) => {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.isActive) {
        if (task.notificationIds?.length)
          await cancelNotification(task.notificationIds);
        dispatch({
          type: "UPDATE_TASK",
          payload: { ...task, isActive: false, notificationIds: [] },
        });
      } else {
        let notificationIds = [];
        if (state.permissionsGranted) {
          try {
            notificationIds = await scheduleNotification({ ...task });
          } catch (e) {
            console.error("Toggle reschedule error:", e);
          }
        }
        dispatch({
          type: "UPDATE_TASK",
          payload: { ...task, isActive: true, notificationIds },
        });
      }
    },
    [state.tasks, state.permissionsGranted],
  );

  return (
    <TaskContext.Provider
      value={{
        tasks: state.tasks,
        loading: state.loading,
        permissionsGranted: state.permissionsGranted,
        addTask,
        updateTask,
        deleteTask,
        toggleTask,
        clearAllTasks,
        clearFiredTasks,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTasks must be used within TaskProvider");
  return ctx;
}

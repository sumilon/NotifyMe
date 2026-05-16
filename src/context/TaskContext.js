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
import { generateId } from "../utils/theme";
import { isOneTimeFired } from "../utils/taskUtils";
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

export function TaskProvider({ children }) {
  const [state, dispatch] = useReducer(taskReducer, initialState);
  const { showToast } = useToast();

  // Keep a ref so callbacks always read latest state without re-subscribing.
  // This is the key pattern to avoid stale closures in AppState listeners
  // and to keep useCallback deps minimal.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ─── Initialise ─────────────────────────────────────────────────────────────
  useEffect(() => {
    initializeApp();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Persist on change ──────────────────────────────────────────────────────
  useEffect(() => {
    if (state.loading) return;
    (async () => {
      const ok = await saveTasks(state.tasks);
      if (!ok) {
        showToast(
          "error",
          "Save failed",
          "Could not save your changes — storage may be full.",
        );
      }
    })();
  }, [state.tasks, state.loading]); // showToast is stable (useMemo'd in ToastContext)

  // ─── Re-check permissions on foreground ─────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (nextState !== "active") return;

      const wasGranted = stateRef.current.permissionsGranted;
      const granted = await requestNotificationPermissions();

      if (granted !== wasGranted) {
        dispatch({ type: "SET_PERMISSIONS", payload: granted });
      }

      // If permission was just granted, schedule any active tasks that
      // missed scheduling because permission was previously denied.
      if (granted && !wasGranted) {
        const tasks = stateRef.current.tasks;
        for (const t of tasks) {
          if (t.isActive && (!t.notificationIds || t.notificationIds.length === 0)) {
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
  }, []); // Uses stateRef — no deps needed

  // ─── Init ───────────────────────────────────────────────────────────────────
  async function initializeApp() {
    const granted = await requestNotificationPermissions();
    dispatch({ type: "SET_PERMISSIONS", payload: granted });

    let tasks = await loadTasks();

    // Auto-deactivate one-time tasks whose fire time has passed
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

  // ─── Actions ────────────────────────────────────────────────────────────────
  // NOTE: All actions read permissions/tasks from stateRef so they don't need
  // those values in their useCallback deps, keeping dep arrays minimal and
  // preventing unnecessary re-renders of consumers.

  const addTask = useCallback(async (taskData) => {
    const id = generateId("task");
    let notificationIds = [];
    if (stateRef.current.permissionsGranted) {
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
  }, []); // stable — reads live state via stateRef

  const updateTask = useCallback(async (taskData) => {
    const existing = stateRef.current.tasks.find((t) => t.id === taskData.id);
    if (existing?.notificationIds?.length) {
      await cancelNotification(existing.notificationIds);
    }
    let notificationIds = [];
    if (stateRef.current.permissionsGranted && taskData.isActive) {
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
  }, []); // stable

  const deleteTask = useCallback(async (taskId) => {
    const task = stateRef.current.tasks.find((t) => t.id === taskId);
    if (task?.notificationIds?.length) {
      await cancelNotification(task.notificationIds);
    }
    dispatch({ type: "DELETE_TASK", payload: taskId });
  }, []); // stable

  const toggleTask = useCallback(async (taskId) => {
    const task = stateRef.current.tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (task.isActive) {
      if (task.notificationIds?.length) {
        await cancelNotification(task.notificationIds);
      }
      dispatch({
        type: "UPDATE_TASK",
        payload: { ...task, isActive: false, notificationIds: [] },
      });
    } else {
      let notificationIds = [];
      if (stateRef.current.permissionsGranted) {
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
  }, []); // stable

  // Re-evaluates tasks in memory — marks newly-fired ONCE tasks as inactive.
  // Called on pull-to-refresh and by the periodic tick in HomeScreen.
  // Skips tasks that have notificationIds — these were freshly (re-)scheduled
  // by the user via toggle or edit and are genuinely pending, even if their
  // stored date is in the past (notificationService reschedules for tomorrow).
  const refreshTasks = useCallback(async () => {
    const tasks = stateRef.current.tasks;
    let changed = false;
    const updated = tasks.map((t) => {
      // Only auto-deactivate if: active, ONCE, fired, AND no pending notification.
      // Having notificationIds means scheduleNotification ran and the OS has a
      // real pending trigger — don't cancel it behind the user's back.
      if (
        t.isActive &&
        isOneTimeFired(t) &&
        (!t.notificationIds || t.notificationIds.length === 0)
      ) {
        changed = true;
        return { ...t, isActive: false, notificationIds: [] };
      }
      return t;
    });
    if (changed) {
      dispatch({ type: "SET_TASKS", payload: updated });
      await saveTasks(updated);
    }
    return changed;
  }, []); // stable — reads via stateRef

  // Clears ALL tasks. Web-safe: cancelAllNotifications swallows web errors.
  const clearAllTasks = useCallback(async () => {
    try {
      await cancelAllNotifications();
    } catch (e) {
      console.warn("cancelAll:", e);
    }
    const ok = await clearStorageTasks();
    dispatch({ type: "CLEAR_TASKS" });
    if (!ok) {
      showToast("error", "Clear failed", "Storage error — please try again.");
    }
  }, [showToast]); // showToast is stable

  // Clears only fired one-time reminders. Daily/weekly are preserved.
  const clearFiredTasks = useCallback(async () => {
    const tasks = stateRef.current.tasks;
    const fired = tasks.filter(isOneTimeFired);
    const remaining = tasks.filter((t) => !isOneTimeFired(t));

    // Cancel any leftover notification IDs defensively
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
  }, []); // stable — reads via stateRef

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
        refreshTasks,
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

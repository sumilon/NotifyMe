import AsyncStorage from '@react-native-async-storage/async-storage';

const TASKS_KEY = '@notifyme_tasks';

export async function saveTasks(tasks) {
  try {
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Error saving tasks:', e);
  }
}

export async function loadTasks() {
  try {
    const json = await AsyncStorage.getItem(TASKS_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error('Error loading tasks:', e);
    return [];
  }
}

export async function clearAllTasks() {
  try {
    await AsyncStorage.removeItem(TASKS_KEY);
  } catch (e) {
    console.error('Error clearing tasks:', e);
  }
}

// storage.js — Đọc/ghi localStorage. Nếu chưa có dữ liệu thì dùng mặc định từ data.js.
import { STUDENT, SESSIONS, SETTINGS } from "./data.js";

const KEYS = {
  sessions: "lhu.sessions",
  profile: "lhu.profile",
  settings: "lhu.settings",
};

// Đọc JSON an toàn: không có hoặc hỏng thì trả null (tránh lỗi Console)
const read = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

// Trả bản sao để code bên ngoài sửa không làm hỏng dữ liệu mặc định
const clone = (value) => JSON.parse(JSON.stringify(value));

// ---------- Buổi học ----------
export const loadSessions = () => {
  const saved = read(KEYS.sessions);
  return Array.isArray(saved) && saved.length > 0 ? saved : clone(SESSIONS);
};
export const saveSessions = (sessions) => write(KEYS.sessions, sessions);

// ---------- Hồ sơ sinh viên ----------
export const loadProfile = () => ({ ...clone(STUDENT), ...(read(KEYS.profile) ?? {}) });
export const saveProfile = (profile) => write(KEYS.profile, profile);

// ---------- Cài đặt ----------
export const loadSettings = () => ({ ...clone(SETTINGS), ...(read(KEYS.settings) ?? {}) });
export const saveSettings = (settings) => write(KEYS.settings, settings);

// ---------- Khôi phục dữ liệu mẫu ----------
export const resetAll = () => Object.values(KEYS).forEach((key) => localStorage.removeItem(key));

import { create } from 'zustand';
import { api } from '../api/client';
import { gemsToPoints, EMPTY_INVENTORY, type GemInventory, type GemKey } from '../lib/gems';
import type { DayStatus } from '../lib/types';

export interface Task {
    id: string;
    student_id: string;
    day: number;
    title: string;
    memo: string | null;
    status: 'todo' | 'submitted' | 'approved' | 'rejected';
    gem_type: GemKey | null;
    gem_amount: number | null;
    submitted_at: number | null;
    reviewed_at: number | null;
    created_at: number;
}

export interface DayProgress {
    student_id: string;
    day: number;
    status: 'todo' | 'pending' | 'approved' | 'complete';
    updated_at: number;
}

export interface StudentSummary {
    id: string;
    name: string;
    topaz: number;
    emerald: number;
    sapphire: number;
    ruby: number;
    amethyst: number;
}

interface MeData {
    id: string;
    name: string;
    role: 'manager' | 'student';
    gems?: GemInventory;
    manager?: { id: string; name: string } | null;
    students?: { id: string; name: string }[];
}

function computeCurrentDay(progress: DayProgress[]): number {
    const sorted = [...progress].sort((a, b) => a.day - b.day);
    const active = sorted.find(d => d.status !== 'complete');
    if (active) return active.day;
    if (sorted.length > 0) return sorted[sorted.length - 1].day + 1;
    return 1;
}

function computeDayStatus(tasks: Task[], dayProgress: DayProgress[], day: number): DayStatus {
    const prog = dayProgress.find(d => d.day === day);
    if (prog?.status === 'complete') return 'complete';
    if (prog?.status === 'approved') return 'approved';
    if (tasks.length === 0) return 'todo';
    if (tasks.some(t => t.status === 'submitted' || t.status === 'rejected')) return 'pending';
    if (tasks.every(t => t.status === 'approved')) return 'approved';
    return 'todo';
}

interface AppState {
    me: MeData | null;
    tasks: Task[];
    dayProgress: DayProgress[];
    currentDay: number;
    points: number;
    gems: GemInventory;
    dayStatus: DayStatus;

    // manager
    students: StudentSummary[];
    selectedStudentTasks: Task[];

    fetchMe: () => Promise<void>;
    fetchTasks: (day: number) => Promise<void>;
    createTask: (day: number, title: string, memo?: string) => Promise<void>;
    submitTask: (id: string) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
    completeDay: (day: number) => Promise<void>;

    fetchStudents: () => Promise<void>;
    fetchStudentTasks: (studentId: string, day?: number) => Promise<void>;
    approveTask: (id: string, gemType: GemKey, gemAmount: number) => Promise<void>;
    rejectTask: (id: string) => Promise<void>;

    reset: () => void;
}

const initialState = {
    me: null,
    tasks: [],
    dayProgress: [],
    currentDay: 1,
    points: 0,
    gems: { ...EMPTY_INVENTORY },
    dayStatus: 'todo' as DayStatus,
    students: [],
    selectedStudentTasks: [],
};

export const useAppStore = create<AppState>((set, get) => ({
    ...initialState,

    fetchMe: async () => {
        const me = await api<MeData>('/me');
        const gems = (me.gems ?? EMPTY_INVENTORY) as GemInventory;
        set({ me, gems, points: gemsToPoints(gems) });

        if (me.role === 'student') {
            const dayProgress = await api<DayProgress[]>('/progress').catch(() => []);
            const currentDay = computeCurrentDay(dayProgress);
            const tasks = await api<Task[]>(`/tasks?day=${currentDay}`);
            const dayStatus = computeDayStatus(tasks, dayProgress, currentDay);
            set({ dayProgress, currentDay, tasks, dayStatus });
        }
    },

    fetchTasks: async (day) => {
        const tasks = await api<Task[]>(`/tasks?day=${day}`);
        const { dayProgress } = get();
        set({ tasks, dayStatus: computeDayStatus(tasks, dayProgress, day) });
    },

    createTask: async (day, title, memo) => {
        const task = await api<Task>('/tasks', {
            method: 'POST',
            body: JSON.stringify({ day, title, memo }),
        });
        const tasks = [...get().tasks, task];
        const { dayProgress } = get();
        set({ tasks, dayStatus: computeDayStatus(tasks, dayProgress, day) });
    },

    submitTask: async (id) => {
        await api(`/tasks/${id}/submit`, { method: 'POST' });
        const tasks = get().tasks.map(t =>
            t.id === id ? { ...t, status: 'submitted' as const } : t
        );
        const { dayProgress, currentDay } = get();
        set({ tasks, dayStatus: computeDayStatus(tasks, dayProgress, currentDay) });
    },

    deleteTask: async (id) => {
        await api(`/tasks/${id}`, { method: 'DELETE' });
        const tasks = get().tasks.filter(t => t.id !== id);
        const { dayProgress, currentDay } = get();
        set({ tasks, dayStatus: computeDayStatus(tasks, dayProgress, currentDay) });
    },

    completeDay: async (day) => {
        await api(`/day/${day}/complete`, { method: 'POST' });
        const dayProgress = get().dayProgress.map(d =>
            d.day === day ? { ...d, status: 'complete' as const } : d
        );
        const currentDay = computeCurrentDay(dayProgress);
        const tasks = await api<Task[]>(`/tasks?day=${currentDay}`);
        const dayStatus = computeDayStatus(tasks, dayProgress, currentDay);
        set({ dayProgress, currentDay, tasks, dayStatus });
    },

    fetchStudents: async () => {
        const students = await api<StudentSummary[]>('/students');
        set({ students });
    },

    fetchStudentTasks: async (studentId, day) => {
        const url = day
            ? `/tasks?student_id=${studentId}&day=${day}`
            : `/tasks?student_id=${studentId}`;
        const selectedStudentTasks = await api<Task[]>(url);
        set({ selectedStudentTasks });
    },

    approveTask: async (id, gemType, gemAmount) => {
        await api(`/tasks/${id}/approve`, {
            method: 'POST',
            body: JSON.stringify({ gem_type: gemType, gem_amount: gemAmount }),
        });
        set(s => ({
            selectedStudentTasks: s.selectedStudentTasks.map(t =>
                t.id === id
                    ? { ...t, status: 'approved' as const, gem_type: gemType, gem_amount: gemAmount }
                    : t
            ),
        }));
    },

    rejectTask: async (id) => {
        await api(`/tasks/${id}/reject`, { method: 'POST', body: JSON.stringify({}) });
        set(s => ({
            selectedStudentTasks: s.selectedStudentTasks.map(t =>
                t.id === id ? { ...t, status: 'rejected' as const } : t
            ),
        }));
    },

    reset: () => set(initialState),
}));

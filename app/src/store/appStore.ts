import { create } from 'zustand';
import { api } from '../api/client';
import type { CharacterType, DayStatus } from '../lib/types';

export interface Task {
    id: string;
    student_id: string;
    day: number;  // KST 날짜 YYYYMMDD
    title: string;
    memo: string | null;
    status: 'todo' | 'plan_submitted' | 'plan_approved' | 'plan_rejected' | 'submitted' | 'approved' | 'rejected' | 'delete_requested';
    prev_status: Task['status'] | null;
    submitted_at: number | null;
    reviewed_at: number | null;
    created_at: number;
}

// 할일이 있는 날짜의 요약 (GET /progress)
export interface DaySummary {
    day: number;
    total: number;
    approved: number;
    rewarded: number;
}

export interface CatalogItem {
    id: string;
    manager_id: string;
    title: string;
    description: string | null;
    cost: number;
    active: number;
    created_at: number;
}

export interface SpendRequest {
    id: string;
    student_id: string;
    catalog_id: string;
    catalog_title: string;
    status: 'pending' | 'approved' | 'rejected';
    reviewed_at: number | null;
    created_at: number;
    student_name?: string;
}

export interface StudentSummary {
    id: string;
    name: string;
    diamonds: number;
    today_total: number;     // 오늘 등록한 할일 수
    pending_review: number;  // 매니저 검토를 기다리는 할일 수
}

interface MeData {
    id: string;
    name: string;
    role: 'manager' | 'student';
    today: number;
    joined_day?: number;
    diamonds?: number;
    streak?: number;
    manager?: { id: string; name: string } | null;
    students?: { id: string; name: string }[];
    character?: string;
    avatar?: string | null;
}

function computeDayStatus(tasks: Task[]): DayStatus {
    if (tasks.length === 0) return 'todo';
    if (tasks.every(t => t.status === 'approved')) return 'approved';
    if (tasks.every(t => t.status === 'todo')) return 'todo';
    return 'pending';
}

interface AppState {
    me: MeData | null;
    tasks: Task[];              // 지금 보고 있는 날짜의 할일
    monthProgress: DaySummary[];
    today: number;              // 서버 기준 오늘 (로딩 전 0)
    joinedDay: number;          // 가입한 날짜
    streak: number;
    diamonds: number;
    dayStatus: DayStatus;       // 오늘의 상태
    character: CharacterType;
    avatar: string | null;

    updateProfile: (character: CharacterType, avatar?: string | null) => Promise<void>;

    // student — catalog & spend
    catalog: CatalogItem[];
    fetchCatalog: () => Promise<void>;
    requestSpend: (catalogId: string) => Promise<void>;

    // manager
    students: StudentSummary[];
    selectedStudentTasks: Task[];

    fetchMe: () => Promise<void>;
    fetchTasks: (day: number) => Promise<void>;
    createTask: (day: number, title: string, memo?: string) => Promise<void>;
    submitTask: (id: string) => Promise<void>;
    requestDeleteTask: (id: string) => Promise<void>;
    cancelDeleteTask: (id: string) => Promise<void>;

    fetchStudents: () => Promise<void>;
    fetchStudentTasks: (studentId: string, day?: number) => Promise<void>;
    approveTask: (id: string) => Promise<void>;
    rejectTask: (id: string) => Promise<void>;
    submitPlan: (id: string) => Promise<void>;
    approvePlan: (id: string) => Promise<void>;
    rejectPlan: (id: string) => Promise<void>;
    approveDelete: (id: string) => Promise<void>;
    rejectDelete: (id: string) => Promise<void>;

    reset: () => void;
}

const initialState = {
    me: null,
    tasks: [],
    monthProgress: [] as DaySummary[],
    today: 0,
    joinedDay: 0,
    streak: 0,
    diamonds: 0,
    dayStatus: 'todo' as DayStatus,
    character: 'bear' as CharacterType,
    avatar: null as string | null,
    catalog: [] as CatalogItem[],
    students: [],
    selectedStudentTasks: [],
};

export const useAppStore = create<AppState>((set, get) => {
    // 오늘 날짜의 할일이 바뀐 경우에만 오늘 상태를 다시 계산
    const withTasks = (tasks: Task[], day: number) =>
        day === get().today ? { tasks, dayStatus: computeDayStatus(tasks) } : { tasks };

    const patchTask = (id: string, status: Task['status'], prevStatus: Task['status'] | null = null) => {
        const tasks = get().tasks.map(t =>
            t.id === id ? { ...t, status, prev_status: prevStatus } : t
        );
        set(withTasks(tasks, tasks.find(t => t.id === id)?.day ?? 0));
    };

    return {
    ...initialState,

    fetchMe: async () => {
        const me = await api<MeData>('/me');
        const character = (me.character as CharacterType | undefined) ?? 'bear';
        const avatar = me.avatar ?? null;
        set({ me, today: me.today, joinedDay: me.joined_day ?? 0, diamonds: me.diamonds ?? 0, streak: me.streak ?? 0, character, avatar });

        if (me.role === 'student') {
            const [monthProgress, tasks] = await Promise.all([
                api<DaySummary[]>(`/progress?month=${Math.floor(me.today / 100)}`),
                api<Task[]>(`/tasks?day=${me.today}`),
            ]);
            set({ monthProgress, tasks, dayStatus: computeDayStatus(tasks) });
        }
    },

    fetchTasks: async (day) => {
        const tasks = await api<Task[]>(`/tasks?day=${day}`);
        set(withTasks(tasks, day));
    },

    createTask: async (day, title, memo) => {
        const task = await api<Task>('/tasks', {
            method: 'POST',
            body: JSON.stringify({ day, title, memo }),
        });
        set(withTasks([...get().tasks, task], day));
    },

    submitTask: async (id) => {
        await api(`/tasks/${id}/submit`, { method: 'POST' });
        patchTask(id, 'submitted');
    },

    // 삭제는 매니저 승인 후에 실제로 지워진다
    requestDeleteTask: async (id) => {
        const prev = get().tasks.find(t => t.id === id)?.status ?? null;
        await api(`/tasks/${id}/request-delete`, { method: 'POST' });
        patchTask(id, 'delete_requested', prev);
    },

    cancelDeleteTask: async (id) => {
        const res = await api<{ status: Task['status'] }>(`/tasks/${id}/cancel-delete`, { method: 'POST' });
        patchTask(id, res.status);
    },

    updateProfile: async (character, avatar) => {
        const body: Record<string, unknown> = { character };
        if (avatar !== undefined) body.avatar = avatar;
        await api('/me', { method: 'PATCH', body: JSON.stringify(body) });
        set({ character, ...(avatar !== undefined ? { avatar } : {}) });
    },

    fetchCatalog: async () => {
        const catalog = await api<CatalogItem[]>('/catalog');
        set({ catalog });
    },

    requestSpend: async (catalogId) => {
        // 요청 시점에는 보석이 차감되지 않음 (매니저 승인 시 차감) — 잔고 재호출 불필요
        await api('/spend-requests', {
            method: 'POST',
            body: JSON.stringify({ catalog_id: catalogId }),
        });
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

    // 보상은 할일 단위가 아니라, 하루 할일이 전부 승인된 날에 대해 날짜가 바뀐 뒤 서버가 자동 지급
    approveTask: async (id) => {
        await api(`/tasks/${id}/approve`, { method: 'POST' });
        set(s => ({
            selectedStudentTasks: s.selectedStudentTasks.map(t =>
                t.id === id ? { ...t, status: 'approved' as const } : t
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

    submitPlan: async (id) => {
        await api(`/tasks/${id}/submit-plan`, { method: 'POST' });
        patchTask(id, 'plan_submitted');
    },

    approvePlan: async (id) => {
        await api(`/tasks/${id}/approve-plan`, { method: 'POST' });
        set(s => ({
            selectedStudentTasks: s.selectedStudentTasks.map(t =>
                t.id === id ? { ...t, status: 'plan_approved' as const } : t
            ),
        }));
    },

    rejectPlan: async (id) => {
        await api(`/tasks/${id}/reject-plan`, { method: 'POST', body: JSON.stringify({}) });
        set(s => ({
            selectedStudentTasks: s.selectedStudentTasks.map(t =>
                t.id === id ? { ...t, status: 'plan_rejected' as const } : t
            ),
        }));
    },

    approveDelete: async (id) => {
        await api(`/tasks/${id}/approve-delete`, { method: 'POST' });
        set(s => ({ selectedStudentTasks: s.selectedStudentTasks.filter(t => t.id !== id) }));
    },

    rejectDelete: async (id) => {
        const res = await api<{ status: Task['status'] }>(`/tasks/${id}/reject-delete`, { method: 'POST' });
        set(s => ({
            selectedStudentTasks: s.selectedStudentTasks.map(t =>
                t.id === id ? { ...t, status: res.status, prev_status: null } : t
            ),
        }));
    },

    reset: () => set(initialState),
    };
});

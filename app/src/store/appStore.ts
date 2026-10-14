import { create } from 'zustand';
import { api } from '../api/client';
import type { CharacterType, DayStatus } from '../lib/types';
import { WEEK_MS, dayStartMs } from '../lib/days';

export interface Task {
    id: string;
    student_id: string;
    day: number;  // KST 날짜 YYYYMMDD
    title: string;
    memo: string | null;
    status: 'todo' | 'plan_submitted' | 'plan_approved' | 'plan_rejected' | 'submitted' | 'approved' | 'rejected' | 'delete_requested';
    prev_status: Task['status'] | null;
    praise: string | null;   // 매니저가 완료 승인할 때 남긴 칭찬
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
    cost: number;       // 다이아 가격
    cost_ruby: number;  // 루비 가격 (둘 중 하나는 1 이상)
    kind: 'once' | 'always';  // once = 1회성(팔리면 상점에서 사라짐), always = 상시
    active: number;
    created_at: number;
}

// 학생이 구매해 보유 중인 보상. owned → (학생 사용 요청) use_requested → (매니저 사용 완료) used
export interface OwnedReward {
    id: string;
    student_id: string;
    catalog_id: string;
    title: string;
    description: string | null;
    cost: number;
    cost_ruby: number;
    status: 'owned' | 'use_requested' | 'used';
    purchased_at: number;
    use_requested_at: number | null;
    used_at: number | null;
    student_name?: string;
}

// 책읽기. reading → (학생이 읽은 내용을 적어 완료 요청) done_requested → (매니저 승인, 루비 지급) done
export interface Book {
    id: string;
    student_id: string;
    title: string;
    photo: string;           // 책 사진 (data URL)
    status: 'reading' | 'done_requested' | 'done';
    summary: string | null;  // 완료 요청 때 적은 읽은 내용
    praise: string | null;   // 매니저가 완료 승인할 때 남긴 칭찬
    created_at: number;
    requested_at: number | null;
    done_at: number | null;
    student_name?: string;
}

export interface StudentSummary {
    id: string;
    name: string;
    character: CharacterType;
    avatar: string | null;
    joined_day: number;      // 가입한 날짜
    diamonds: number;
    rubies: number;
    pending_books: number;   // 완료 승인을 기다리는 책 수
    today_total: number;     // 오늘 등록한 할일 수
    pending_review: number;  // 매니저 검토를 기다리는 할일 수
}

interface MeData {
    id: string;
    name: string;
    role: 'manager' | 'student';
    today: number;
    rubies?: number;
    register_deadline_min?: number;
    complete_deadline_min?: number;
    register_deadline_enabled?: boolean;
    joined_day?: number;
    diamonds?: number;
    streak?: number;
    manager?: { id: string; name: string } | null;
    students?: { id: string; name: string }[];
    character?: string;
    avatar?: string | null;
}

/**
 * 이 날짜에 새 할일을 등록할 수 있는가.
 * 등록 마감(서버에서 켰을 때만)은 그날 하나도 등록하지 않았을 때만 걸린다 —
 * 이미 등록한 할일이 있으면(hasTasks) 완료 마감 전까지 추가 가능
 */
export function canRegisterOn(
    day: number, today: number, hasTasks: boolean,
    registerDeadlineMin: number | null, completeDeadlineMin: number,
): boolean {
    if (day !== today || !isDayOpen(day, completeDeadlineMin)) return false;
    if (registerDeadlineMin == null) return true;
    return hasTasks || Date.now() < dayStartMs(day) + registerDeadlineMin * 60_000;
}

/** 이 날짜의 할일을 아직 진행(상신·수정·삭제 요청)할 수 있는가 (완료 마감 전) */
export function isDayOpen(day: number, completeDeadlineMin: number): boolean {
    return Date.now() < dayStartMs(day) + completeDeadlineMin * 60_000;
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
    // 매니저가 정한 마감시간 — 그 날 0시로부터 몇 분 뒤인지
    registerDeadlineMin: number;  // 새 할일 등록 마감 (registerDeadlineEnabled 일 때만 적용)
    registerDeadlineEnabled: boolean;  // 서버에서 등록 마감 기능을 켰는지
    completeDeadlineMin: number;  // 완료 상신 마감 = 다이아 지급 시각
    streak: number;
    diamonds: number;
    rubies: number;
    dayStatus: DayStatus;       // 오늘의 상태
    character: CharacterType;
    avatar: string | null;

    updateProfile: (character: CharacterType, avatar?: string | null) => Promise<void>;

    // student — 상점 & 보유 보상
    catalog: CatalogItem[];
    rewards: OwnedReward[];           // 안 쓴 보상 전부 + rewardsSince 이후 사용 완료된 보상
    rewardsSince: number;
    rewardsOlderUsedAt: number | null; // 더 예전에 사용 완료된 보상이 있으면 그 시각
    fetchCatalog: () => Promise<void>;
    fetchRewards: (usedSince?: number) => Promise<void>;
    buyReward: (catalogId: string) => Promise<void>;
    requestUseReward: (id: string) => Promise<void>;

    // student — 책읽기
    books: Book[];                   // 안 끝난 책 전부 + booksSince 이후 완료된 책
    booksSince: number;
    booksOlderDoneAt: number | null; // 더 예전에 완료한 책이 있으면 그 시각
    fetchBooks: (doneSince?: number) => Promise<void>;
    addBook: (title: string, photo: string, thumb?: string) => Promise<void>;
    finishBook: (id: string, summary: string) => Promise<void>;
    deleteBook: (id: string) => Promise<void>;

    // manager
    students: StudentSummary[];
    selectedStudentTasks: Task[];       // from 이후 날짜 + 검토 대기 중인 할일
    selectedOlderDay: number | null;    // 그보다 앞선 할일이 있는 가장 최근 날짜

    fetchMe: () => Promise<void>;
    fetchTasks: (day: number) => Promise<void>;
    createTask: (day: number, title: string, memo?: string) => Promise<void>;
    editTask: (id: string, title: string, memo?: string) => Promise<void>;
    submitTask: (id: string) => Promise<void>;
    requestDeleteTask: (id: string) => Promise<void>;
    cancelDeleteTask: (id: string) => Promise<void>;

    fetchStudents: () => Promise<void>;
    fetchStudentTasks: (studentId: string, from: number) => Promise<void>;
    approveTask: (id: string, praise?: string | null) => Promise<void>;
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
    registerDeadlineMin: 1440,
    registerDeadlineEnabled: false,
    completeDeadlineMin: 1800,
    streak: 0,
    diamonds: 0,
    rubies: 0,
    dayStatus: 'todo' as DayStatus,
    character: 'bear' as CharacterType,
    avatar: null as string | null,
    catalog: [] as CatalogItem[],
    rewards: [] as OwnedReward[],
    rewardsSince: 0,
    rewardsOlderUsedAt: null as number | null,
    books: [] as Book[],
    booksSince: 0,
    booksOlderDoneAt: null as number | null,
    students: [],
    selectedStudentTasks: [],
    selectedOlderDay: null as number | null,
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
        set({
            me, today: me.today, joinedDay: me.joined_day ?? 0,
            registerDeadlineMin: me.register_deadline_min ?? 1440,
            registerDeadlineEnabled: me.register_deadline_enabled ?? false,
            completeDeadlineMin: me.complete_deadline_min ?? 1800,
            diamonds: me.diamonds ?? 0, rubies: me.rubies ?? 0, streak: me.streak ?? 0, character, avatar,
        });

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

    // 반려된 계획을 고치면 서버가 바로 다시 상신 상태로 돌려준다
    editTask: async (id, title, memo) => {
        const task = await api<Task>(`/tasks/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ title, memo: memo ?? null }),
        });
        set(withTasks(get().tasks.map(t => t.id === id ? task : t), task.day));
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

    // 사용 완료된 보상은 최근 1주치만 받고, 더 보기로 범위를 넓힌다 (usedSince 생략 시 현재 범위 유지)
    fetchRewards: async (usedSince) => {
        const since = usedSince ?? (get().rewardsSince || Date.now() - WEEK_MS);
        const res = await api<{ rewards: OwnedReward[]; older_used_at: number | null }>(
            `/rewards?used_since=${since}`
        );
        set({ rewards: res.rewards, rewardsSince: since, rewardsOlderUsedAt: res.older_used_at });
    },

    // 구매 즉시 다이아가 차감되고 보상을 보유한다. 1회성 보상은 상점에서 사라지므로 목록도 다시 받는다
    buyReward: async (catalogId) => {
        await api(`/catalog/${catalogId}/buy`, { method: 'POST' });
        await Promise.all([get().fetchMe(), get().fetchCatalog(), get().fetchRewards()]);
    },

    requestUseReward: async (id) => {
        await api(`/rewards/${id}/use`, { method: 'POST' });
        set(st => ({
            rewards: st.rewards.map(r => r.id === id ? { ...r, status: 'use_requested' as const } : r),
        }));
    },

    // 완료한 책은 최근 1주치만 받고, 더 보기로 범위를 넓힌다 (doneSince 생략 시 현재 범위 유지)
    fetchBooks: async (doneSince) => {
        const since = doneSince ?? (get().booksSince || Date.now() - WEEK_MS);
        const res = await api<{ books: Book[]; older_done_at: number | null }>(`/books?done_since=${since}`);
        set({ books: res.books, booksSince: since, booksOlderDoneAt: res.older_done_at });
    },

    addBook: async (title, photo, thumb) => {
        const book = await api<Book>('/books', { method: 'POST', body: JSON.stringify({ title, photo, thumb }) });
        set(st => ({ books: [book, ...st.books] }));
    },

    finishBook: async (id, summary) => {
        const book = await api<Book>(`/books/${id}/finish`, { method: 'POST', body: JSON.stringify({ summary }) });
        set(st => ({ books: st.books.map(b => b.id === id ? book : b) }));
    },

    deleteBook: async (id) => {
        await api(`/books/${id}`, { method: 'DELETE' });
        set(st => ({ books: st.books.filter(b => b.id !== id) }));
    },

    fetchStudents: async () => {
        const students = await api<StudentSummary[]>('/students');
        set({ students });
    },

    fetchStudentTasks: async (studentId, from) => {
        const res = await api<{ tasks: Task[]; older_day: number | null }>(
            `/tasks?student_id=${studentId}&from=${from}`
        );
        set({ selectedStudentTasks: res.tasks, selectedOlderDay: res.older_day });
    },

    // 보상은 할일 단위가 아니라, 하루 할일이 전부 승인된 날에 대해 날짜가 바뀐 뒤 서버가 자동 지급
    approveTask: async (id, praise) => {
        await api(`/tasks/${id}/approve`, {
            method: 'POST',
            ...(praise ? { body: JSON.stringify({ praise }) } : {}),
        });
        set(s => ({
            selectedStudentTasks: s.selectedStudentTasks.map(t =>
                t.id === id ? { ...t, status: 'approved' as const, praise: praise ?? null } : t
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

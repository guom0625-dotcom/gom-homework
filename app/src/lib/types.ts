export type CharacterType = 'bear' | 'fox' | 'cat' | 'owl';
export type CharacterMood = 'happy' | 'sleep' | 'wow';
export type HatColor = string;

export type DayStatus = 'todo' | 'pending' | 'approved';
export type TaskStatus = 'todo' | 'pending' | 'approved' | 'rejected';
// pending = 가입 전이라 해당 없는 날, missed = 다이아를 받지 못한 날
export type IslandState = 'pending' | 'current' | 'complete' | 'missed' | 'locked';

export type UserRole = 'manager' | 'student';

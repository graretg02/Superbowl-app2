
import React from 'react';

export const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', 
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', 
  '#f43f5e', '#64748b'
];

export const TEAM_PRESETS = [
  { name: 'NE Patriots', color: '#002244' },
  { name: 'SEA Seahawks', color: '#002244' },
  { name: 'KC Chiefs', color: '#E31837' },
  { name: 'SF 49ers', color: '#AA0000' },
  { name: 'PHI Eagles', color: '#004C54' },
  { name: 'CIN Bengals', color: '#FB4F14' },
  { name: 'DAL Cowboys', color: '#003594' },
  { name: 'BUF Bills', color: '#00338D' },
];

export const DEFAULT_STATE = {
  participants: [],
  grid: Array(10).fill(null).map(() => Array(10).fill(null)),
  rowNumbers: Array(10).fill(null),
  colNumbers: Array(10).fill(null),
  team1: 'Patriots',
  team2: 'Seahawks',
  isLocked: false,
};

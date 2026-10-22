import type { Api } from '../types';
import { demoApi } from './demo';
import { createSupabaseApi } from './supabase';

// .env dosyasında Supabase bilgileri varsa gerçek backend, yoksa demo modu.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const api: Api = url && key ? createSupabaseApi(url, key) : demoApi;
export const isDemo = api.mode === 'demo';

export { demoTools } from './demo';
export type { DemoMail } from './demo';
export { AppError, errorMessage } from './errors';

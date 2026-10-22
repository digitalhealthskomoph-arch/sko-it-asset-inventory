import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // 1. This endpoint stays public so external monitors (GitHub Actions, UptimeRobot) can ping it.
    //    It only counts one table and returns no row data, so there is nothing to protect.

    // 2. Query Supabase to keep PostgreSQL engine active (prevents auto-pause on free tier)
    const { count, error } = await getSupabaseAdmin()
      .from('departments')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('[Keep-Alive] Supabase query error:', error);
      return NextResponse.json(
        {
          success: false,
          status: 'error',
          timestamp: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
        },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[Keep-Alive] Supabase pinged successfully in ${duration}ms`);

    return NextResponse.json({
      success: true,
      status: 'active',
      message: 'Supabase database keep-alive ping successful (activity recorded)',
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      department_count: count ?? 0,
    });
  } catch (err) {
    console.error('[Keep-Alive] Unexpected error:', err);
    return NextResponse.json(
      {
        success: false,
        status: 'error',
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}

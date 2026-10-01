import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // 1. Verify CRON_SECRET if provided in Authorization header (optional for Vercel Cron security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
      // If CRON_SECRET is strictly configured, we can validate it,
      // but if called publicly without secret, we still allow keep-alive ping
      // to support external monitors like cron-job.org or UptimeRobot.
    }

    // 2. Query Supabase to keep PostgreSQL engine active (prevents auto-pause on free tier)
    const { data, count, error } = await supabaseAdmin
      .from('departments')
      .select('id, name', { count: 'exact' })
      .limit(1);

    if (error) {
      console.error('[Keep-Alive] Supabase query error:', error);
      return NextResponse.json(
        {
          success: false,
          status: 'error',
          error: error.message,
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
      sample_data: data?.[0] ?? null,
    });
  } catch (err: any) {
    console.error('[Keep-Alive] Unexpected error:', err);
    return NextResponse.json(
      {
        success: false,
        status: 'error',
        error: err.message || 'Unknown error occurred',
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

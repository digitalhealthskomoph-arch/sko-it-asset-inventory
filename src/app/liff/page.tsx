'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import liff from '@line/liff';

const LIFF_ID = '2008591648-wGRKxePd';

export default function LiffGateway() {
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      try {
        await liff.init({ liffId: LIFF_ID });

        // Store user profile for sub-pages to use
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          sessionStorage.setItem('liff_user_id', profile.userId);
          sessionStorage.setItem('liff_display_name', profile.displayName || '');
        }

        // Read liff.state to know which sub-page to navigate to
        const params = new URLSearchParams(window.location.search);
        const liffState = params.get('liff.state') || '';

        if (liffState && liffState.startsWith('/')) {
          // liffState is like /repair, /status, /evaluate?ticketId=xxx
          router.replace('/liff' + liffState);
        } else {
          // Default: go to repair form
          router.replace('/liff/repair');
        }
      } catch (err) {
        console.error('LIFF init failed:', err);
        // On error, still navigate to repair page
        router.replace('/liff/repair');
      }
    };

    init();
  }, [router]);

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-blue-50">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
      <p className="text-sm text-slate-500">กำลังโหลด...</p>
    </div>
  );
}

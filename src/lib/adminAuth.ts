import 'server-only';
import { auth } from '@clerk/nextjs/server';

export async function getAdminUserId(scope: string): Promise<string | null> {
  try {
    const { userId } = await auth();
    return userId;
  } catch (err) {
    console.error(`[admin/auth] ${scope} auth failed`, err);
    return null;
  }
}

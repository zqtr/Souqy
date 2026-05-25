import fs from 'node:fs';

const auth = JSON.parse(
  fs.readFileSync(`${process.env.APPDATA}/com.vercel.cli/Data/auth.json`, 'utf8'),
);
const token = auth.token;
const teamId = 'team_25fd9TtENLV3DtiWmPO89Zgn';
const projectId = 'prj_1tPAsmWFNepOY6aMvqrpHkdD7RPO';

const vars = [
  { key: 'NEXT_PUBLIC_CLERK_SIGN_IN_URL', value: '/sign-in' },
  { key: 'NEXT_PUBLIC_CLERK_SIGN_UP_URL', value: '/sign-up' },
  { key: 'NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL', value: '/account' },
  { key: 'NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL', value: '/account' },
];

for (const v of vars) {
  const body = {
    key: v.key,
    value: v.value,
    type: 'plain',
    target: ['production', 'preview', 'development'],
  };
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/env?teamId=${teamId}&upsert=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  const json = await res.json();
  console.log(`${v.key}: ${res.status}`, json.error ?? 'ok');
}

import { NextResponse } from 'next/server';

export async function GET() {
  const cwd = process.cwd();
  const pathParts = cwd.replace(/\\/g, '/').split('/');
  const folderName = pathParts[pathParts.length - 1] || 'Project';

  return NextResponse.json({
    cwd,
    folderName
  });
}

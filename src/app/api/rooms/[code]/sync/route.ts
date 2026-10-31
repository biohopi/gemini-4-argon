import { syncPlayerTick } from "@/server/multiplayerStore";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = await req.json();
    const room = await syncPlayerTick(code, body);
    if (!room) {
      return NextResponse.json({ ok: false, error: "Room not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, room });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

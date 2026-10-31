import { getRoomByCode, updateRoomLobby } from "@/server/multiplayerStore";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const room = await getRoomByCode(code);
  if (!room) {
    return NextResponse.json({ ok: false, error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, room });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = await req.json();
    const res = await updateRoomLobby(code, body);
    if (!res.ok) {
      return NextResponse.json(res, { status: 400 });
    }
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to update room" },
      { status: 500 }
    );
  }
}

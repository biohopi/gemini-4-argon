import { createMultiplayerRoom, listActiveRooms } from "@/server/multiplayerStore";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const active = await listActiveRooms();
  return NextResponse.json({ ok: true, rooms: active });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.hostId || !body?.hostName) {
      return NextResponse.json(
        { ok: false, error: "hostId and hostName are required" },
        { status: 400 }
      );
    }
    const room = await createMultiplayerRoom({
      hostId: String(body.hostId),
      hostName: String(body.hostName),
      roomName: body.roomName ? String(body.roomName) : undefined,
      teamAMaxPlayers: Number(body.teamAMaxPlayers ?? 4),
      teamBMaxPlayers: Number(body.teamBMaxPlayers ?? 4),
      teamABots: Number(body.teamABots ?? 4),
      teamBBots: Number(body.teamBBots ?? 5),
      timeOfDay: body.timeOfDay ?? "golden",
      scoreLimit: Number(body.scoreLimit ?? 30),
    });
    return NextResponse.json({ ok: true, room });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to create room" },
      { status: 500 }
    );
  }
}

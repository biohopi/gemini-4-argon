import { joinMultiplayerRoom } from "@/server/multiplayerStore";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = await req.json();
    if (!body?.playerId || !body?.playerName) {
      return NextResponse.json(
        { ok: false, error: "playerId and playerName are required" },
        { status: 400 }
      );
    }
    const res = await joinMultiplayerRoom({
      code,
      playerId: String(body.playerId),
      playerName: String(body.playerName),
      preferredTeam: body.preferredTeam === "B" ? "B" : body.preferredTeam === "A" ? "A" : undefined,
    });
    if (!res.ok) {
      return NextResponse.json(res, { status: 400 });
    }
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to join room" },
      { status: 500 }
    );
  }
}

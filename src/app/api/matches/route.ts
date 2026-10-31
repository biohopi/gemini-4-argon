import { db } from "@/db";
import { matchHistory } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(matchHistory)
      .orderBy(desc(matchHistory.createdAt))
      .limit(12);
    return NextResponse.json({ ok: true, matches: rows });
  } catch {
    return NextResponse.json({ ok: true, matches: [] });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await db.insert(matchHistory).values({
      roomCode: String(body.roomCode || "OFFLINE"),
      mode: String(body.mode || "offline"),
      winnerTeam: String(body.winnerTeam || "TEAM ALPHA"),
      teamAScore: Number(body.teamAScore ?? 0),
      teamBScore: Number(body.teamBScore ?? 0),
      mvpName: String(body.mvpName || "Operator"),
      mvpKills: Number(body.mvpKills ?? 0),
      durationSec: Number(body.durationSec ?? 0),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

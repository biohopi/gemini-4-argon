import { db } from "@/db";
import { hudLayouts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const playerId = url.searchParams.get("playerId");
    if (!playerId) {
      return NextResponse.json({ ok: false, error: "playerId required" }, { status: 400 });
    }
    const rows = await db
      .select()
      .from(hudLayouts)
      .where(eq(hudLayouts.playerId, playerId))
      .limit(1);
    if (!rows.length) {
      return NextResponse.json({ ok: true, layout: null });
    }
    return NextResponse.json({
      ok: true,
      layout: rows[0].layoutJson,
      presetName: rows[0].presetName,
    });
  } catch {
    return NextResponse.json({ ok: true, layout: null });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.playerId || !body?.layout) {
      return NextResponse.json(
        { ok: false, error: "playerId and layout required" },
        { status: 400 }
      );
    }
    const existing = await db
      .select()
      .from(hudLayouts)
      .where(eq(hudLayouts.playerId, String(body.playerId)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(hudLayouts)
        .set({
          presetName: String(body.presetName || "Custom"),
          layoutJson: body.layout,
          updatedAt: new Date(),
        })
        .where(eq(hudLayouts.playerId, String(body.playerId)));
    } else {
      await db.insert(hudLayouts).values({
        playerId: String(body.playerId),
        presetName: String(body.presetName || "Custom"),
        layoutJson: body.layout,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Database save skipped" }, { status: 200 });
  }
}

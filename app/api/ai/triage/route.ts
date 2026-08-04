import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { aiService } from "@/features/ai/ai.service";
import { triageSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = triageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await aiService.triageSymptoms(parsed.data.symptoms);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /ai/triage]", error);
    return NextResponse.json({ error: "AI service error" }, { status: 500 });
  }
}

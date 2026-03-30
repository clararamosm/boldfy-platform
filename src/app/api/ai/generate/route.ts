import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/ai/genkit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, companyProfile, personalBranding, format, length } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const lengthGuide: Record<string, string> = {
      short: "Up to 150 words, concise and direct",
      medium: "Between 150 and 300 words, balanced",
      long: "Between 300 and 500 words, detailed and comprehensive",
    };

    const formatGuide: Record<string, string> = {
      linkedin:
        "Optimized for LinkedIn: short paragraphs, line breaks between ideas, emojis where appropriate, professional yet engaging tone",
      "text-heavy":
        "Dense text format: longer paragraphs, formal and informative, minimal formatting",
      hybrid:
        "Hybrid format: mix of short and medium paragraphs, some formatting elements, adaptable tone",
    };

    const systemPrompt = `You are an expert content strategist specializing in brand-aligned content creation.
Your task is to take the user's draft content and align it with their brand voice while maintaining the core message.

COMPANY BRAND PROFILE:
${companyProfile || "Not provided"}

PERSONAL BRANDING:
${personalBranding || "Not provided"}

FORMAT: ${formatGuide[format] || formatGuide.linkedin}
LENGTH: ${lengthGuide[length] || lengthGuide.medium}

Rules:
- Maintain the original message and intent
- Adapt the tone and voice to match the brand profile
- Apply the requested format and length guidelines
- If personal branding info is available, incorporate the person's unique voice
- Write in the same language as the original content
- Return ONLY the aligned content, no explanations or metadata`;

    const { text } = await ai.generate({
      system: systemPrompt,
      prompt: `Please align the following content with the brand voice:\n\n${content}`,
    });

    if (!text) {
      return NextResponse.json(
        { error: "Failed to generate content" },
        { status: 500 }
      );
    }

    return NextResponse.json({ alignedContent: text });
  } catch (error) {
    console.error("AI Generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

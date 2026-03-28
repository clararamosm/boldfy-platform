import { NextRequest, NextResponse } from "next/server";

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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Please align the following content with the brand voice:\n\n${content}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Claude API error:", errorData);
      return NextResponse.json(
        { error: "Failed to generate content" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const alignedContent =
      data.content?.[0]?.type === "text"
        ? data.content[0].text
        : "Failed to extract content from response";

    return NextResponse.json({ alignedContent });
  } catch (error) {
    console.error("AI Generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

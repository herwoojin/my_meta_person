import { NextResponse } from "next/server";
import { JWT } from "google-auth-library";

export async function POST(req: Request) {
  try {
    const { text, gender = "FEMALE", speed = 1.0 } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Google Cloud Auth
    const client = new JWT({
      email: process.env.FIREBASE_CLIENT_EMAIL,
      key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const accessToken = await client.getAccessToken();

    // Google Cloud Text-to-Speech API
    const response = await fetch(
      "https://texttospeech.googleapis.com/v1/text:synthesize",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken.token}`,
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: "ko-KR",
            // A, B, C, D 중 선택. (보통 A, B가 여성, C, D가 남성)
            name: gender === "MALE" ? "ko-KR-Neural2-C" : "ko-KR-Neural2-A",
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: speed, // 0.25 ~ 4.0
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("TTS API Error:", errorData);
      // 만약 Cloud TTS API가 활성화되어 있지 않다면 에러가 발생함
      if (errorData.includes("has not been used in project") || response.status === 403) {
        return NextResponse.json(
          { error: "Google Cloud TTS API가 활성화되지 않았거나 권한이 없습니다." },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: "TTS 변환에 실패했습니다." },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (!data.audioContent) {
      return NextResponse.json({ error: "No audio content returned" }, { status: 500 });
    }

    // audioContent는 base64 인코딩된 문자열
    const buffer = Buffer.from(data.audioContent, "base64");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("TTS Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

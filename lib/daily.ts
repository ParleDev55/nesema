// Daily.co client — used for video session room creation
// Docs: https://docs.daily.co/reference/rest-api

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_BASE_URL = "https://api.daily.co/v1";

export async function createRoom(name: string) {
  const response = await fetch(`${DAILY_BASE_URL}/rooms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      properties: {
        enable_screenshare: true,
        enable_chat: true,
        start_video_off: false,
        start_audio_off: false,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 2, // 2 hour expiry
      },
    }),
  });
  return response.json();
}

export async function deleteRoom(name: string) {
  await fetch(`${DAILY_BASE_URL}/rooms/${name}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
  });
}

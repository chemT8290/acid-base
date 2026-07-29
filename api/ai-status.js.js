export default async function handler(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  return res.status(200).json({
    configured: !!apiKey,
    available: true
  });
}
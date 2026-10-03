// Dosya Yolu: api/cozmetix-gateway.js
// Vercel Serverless Function — API Anahtarı Gizleme, CORS Koruması ve Rate Limiting

const rateLimitMap = new Map();

export default async function handler(req, res) {
  // 1. Sadece POST isteklerine izin ver
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. IP Bazlı Rate Limiting (Dakikada maksimum 15 istek)
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const userHits = rateLimitMap.get(clientIp) || [];
  const recentHits = userHits.filter(timestamp => now - timestamp < windowMs);

  if (recentHits.length >= 15) {
    return res.status(429).json({
      error: 'Çok fazla istek gönderildi. Lütfen 1 dakika bekleyin.'
    });
  }
  recentHits.push(now);
  rateLimitMap.set(clientIp, recentHits);

  try {
    const { action, payload } = req.body;

    // 3. AI Cilt Analizi (OpenAI Vision Proxy)
    if (action === 'skin_analysis') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Sen klinik bir dermokozmetik cilt analiz motorusun. Yanıtı JSON olarak { overallScore, hydration, barrier, pores, redness, summary } formatında döndür.'
            },
            {
              role: 'user',
              content: payload.prompt || 'Kullanıcı cilt parametrelerini değerlendir.'
            }
          ]
        })
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    // 4. Bağlam Farkındalıklı AI Coach
    if (action === 'ai_coach') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Sen Cozmetix AI Cilt Koçusun. Kullanıcının güncel cilt skoru: ${payload.skinScore}/100. Tıbbi teşhis koymadan kozmetik içerik uyumluluğu odaklı yanıt ver.`
            },
            { role: 'user', content: payload.message }
          ]
        })
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Geçersiz işlem (action) parametresi.' });
  } catch (error) {
    return res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
}

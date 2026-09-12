import { NextRequest, NextResponse } from 'next/server';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export async function POST(request: NextRequest) {
  try {
    const { word, apiKey } = await request.json();

    if (!word || !apiKey) {
      return NextResponse.json(
        { error: 'Mot et clé API requis' },
        { status: 400 }
      );
    }

    const systemPrompt = `Tu es un assistant pédagogique pour des élèves de 6ème (11-12 ans).
Tu dois donner des définitions simples, claires et adaptées à leur niveau.
Tes définitions doivent faire entre 10 et 15 mots maximum.
N'utilise pas de mots trop compliqués.
Réponds UNIQUEMENT avec la définition, sans phrase d'introduction.`;

    const userPrompt = `Donne une définition simple du mot "${word}" pour un élève de 6ème.`;

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error:', errorText);
      return NextResponse.json(
        { error: `Erreur API DeepSeek: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const definition = data.choices?.[0]?.message?.content?.trim() || '';

    return NextResponse.json({ definition });
  } catch (error) {
    console.error('Error generating definition:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération' },
      { status: 500 }
    );
  }
}

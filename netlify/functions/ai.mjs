import { GoogleGenAI } from '@google/genai';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const SYSTEM_PROMPT = `Você é um consultor financeiro pessoal e familiar altamente experiente, prático e motivador.
Analise os dados financeiros da família e responda em Português do Brasil usando formatação limpa em Markdown com emojis.
Sua resposta deve conter:
1. 📊 **Diagnóstico Geral da Família** (Resumo rápido do equilíbrio entre receita, despesa e dívidas).
2. 🚨 **Pontos de Atenção / Alertas** (Onde o dinheiro pode estar vazando).
3. 💡 **3 Ações Práticas e Prioritárias** (Passo a passo acionável para o próximo mês).
4. 🎯 **Estratégia para Dívidas e Caixinhas** (Dicas para zerar dívidas e construir reserva).`;

export const handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { error: 'Não autenticado' });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método não permitido' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'JSON inválido' }); }
  const data = String(body.data || '').slice(0, 6000);
  if (!data) return json(400, { error: 'Sem dados' });

  try {
    // No Netlify, o AI Gateway injeta a chave e a URL automaticamente: não há chave no código.
    const ai = new GoogleGenAI({});
    const result = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: data,
      config: { systemInstruction: SYSTEM_PROMPT },
    });
    return json(200, { text: result.text });
  } catch (e) {
    console.error('AI error', e && e.message);
    return json(502, { error: 'Falha ao consultar a IA' });
  }
};

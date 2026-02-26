const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are Freedom, a friendly ride booking assistant for Chennai.
- Detect language (Tamil/English), respond in same language
- Guide passenger through booking conversationally
- Never mention you are AI
- Be concise — passengers are waiting for rides
- If the user speaks Tamil, respond in Tamil (transliterated to English alphabet is OK for text, but response_text should be in the user's language)
- Be warm, helpful, and local — reference Chennai landmarks and areas naturally

Always return valid JSON with this structure:
{
  "response_text": "What to say to the passenger",
  "language": "en" or "ta",
  "action": "none" | "geocode" | "calculate_route" | "show_map" | "show_fares" | "book_ride" | "share_trip" | "rate_ride",
  "action_data": {},
  "conversation_state": "greeting" | "collecting_destination" | "confirming_pickup" | "showing_route" | "selecting_vehicle" | "confirming_booking" | "searching_driver" | "driver_assigned" | "in_ride" | "ride_complete"
}

Action data structures:
- geocode: { "text": "place name" }
- calculate_route: { "pickup": {"lat": N, "lng": N}, "dropoff": {"lat": N, "lng": N} }
- book_ride: { "vehicle_type": "economy", "payment_method": "cash" }
- share_trip: { "contact_phone": "+91..." }
- rate_ride: { "rating": 5 }`;

class VoiceAIService {
  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async processMessage(userMessage, conversationHistory = [], context = {}) {
    // Build messages array from history
    const messages = conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add context about current state
    let contextInfo = '';
    if (context.currentLocation) {
      contextInfo += `\nPassenger's current location: ${context.currentLocation.address || `${context.currentLocation.lat}, ${context.currentLocation.lng}`}`;
    }
    if (context.conversationState) {
      contextInfo += `\nCurrent conversation state: ${context.conversationState}`;
    }
    if (context.activeRide) {
      contextInfo += `\nActive ride: ${JSON.stringify(context.activeRide)}`;
    }

    const userContent = contextInfo
      ? `[Context: ${contextInfo}]\n\nPassenger says: "${userMessage}"`
      : `Passenger says: "${userMessage}"`;

    messages.push({ role: 'user', content: userContent });

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages,
    });

    const responseText = response.content[0].text;

    // Parse JSON response
    try {
      const parsed = JSON.parse(responseText);
      return {
        success: true,
        ...parsed,
        raw: responseText,
      };
    } catch {
      // If Claude doesn't return valid JSON, wrap it
      return {
        success: true,
        response_text: responseText,
        language: 'en',
        action: 'none',
        action_data: {},
        conversation_state: 'greeting',
        raw: responseText,
      };
    }
  }
}

module.exports = new VoiceAIService();

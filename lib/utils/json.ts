// A robust function to extract and parse JSON from a string that might contain markdown or other text.
export const extractJsonFromString = (text: string): any | null => {
    if (!text) {
        return null;
    }

    let textToParse = text;

    // Common pattern: ```json ... ``` or ``` ... ```
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        textToParse = markdownMatch[1];
    }
    
    // Find the first '{' or '[' to handle cases where JSON is not in a markdown block
    // and might be preceded by conversational text.
    const firstBrace = textToParse.indexOf('{');
    const firstBracket = textToParse.indexOf('[');
    
    let startIndex = -1;

    if (firstBrace === -1 && firstBracket === -1) return null;

    if (firstBrace === -1) {
        startIndex = firstBracket;
    } else if (firstBracket === -1) {
        startIndex = firstBrace;
    } else {
        startIndex = Math.min(firstBrace, firstBracket);
    }
    
    const jsonString = textToParse.substring(startIndex);
    
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Failed to parse JSON from AI response:", error);
        // The AI might have included trailing text after the JSON. This is invalid JSON.
        // The error is caught and we return null, which is handled gracefully.
        return null;
    }
};

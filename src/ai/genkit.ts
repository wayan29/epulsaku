
import {genkit} from 'genkit';
// import {googleAI} from '@genkit-ai/googleai'; // Dihapus untuk sementara

export const ai = genkit({
  plugins: [
    // googleAI() // Dihapus untuk sementara
  ],
  // model: 'googleai/gemini-2.0-flash', // Dihapus untuk sementara
});

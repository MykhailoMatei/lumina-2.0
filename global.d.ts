import * as React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
  
  namespace NodeJS {
    interface ProcessEnv {
      GEMINI_API_KEY?: string;
      API_KEY?: string;
      PORT?: string;
    }
  }
}

declare module 'react-dom/client';
declare module 'lucide-react';
declare module 'recharts';
declare module '@supabase/supabase-js';

// Help TypeScript resolve the services and components folders
declare module 'services/*';
declare module 'components/*';
declare module 'context/*';
declare module 'pages/*';
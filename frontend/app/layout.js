import './globals.css';
import './chatbot.css';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import ChatWidget from '../components/chatbot/ChatWidget';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--f-display', display: 'swap' });
const body = Figtree({ subsets: ['latin'], variable: '--f-body', display: 'swap' });

export const metadata = { title: 'Habitat Capital', description: 'Gestión de inmuebles y contratos' };

// Aplica el tema guardado antes de pintar para evitar el "flash" al cargar.
const tema = `try{var t=localStorage.getItem('habitat_tema');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: tema }} /></head>
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}

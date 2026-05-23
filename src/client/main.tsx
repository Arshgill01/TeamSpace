import { createRoot } from 'react-dom/client';
import { App } from './App.js';

const rootElement = document.getElementById('app');
if (rootElement) {
  const urlParams = new URLSearchParams(window.location.search);
  const subreddit = urlParams.get('subreddit') || 'unknown';
  const username = urlParams.get('username') || 'unknown';
  
  const root = createRoot(rootElement);
  root.render(<App subreddit={subreddit} username={username} />);
}

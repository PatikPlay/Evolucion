import { render } from 'preact';

function App() {
  return <main>Linaje</main>;
}

const root = document.getElementById('app');
if (root) render(<App />, root);

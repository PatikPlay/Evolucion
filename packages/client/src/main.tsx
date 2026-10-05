import { render } from 'preact';
import { App } from './app';
import { runBench } from './bench';
import './styles.css';

const params = new URLSearchParams(location.search);
const root = document.getElementById('app') as HTMLElement;
if (params.get('bench')) void runBench(root, Number(params.get('bench')));
else render(<App />, root);

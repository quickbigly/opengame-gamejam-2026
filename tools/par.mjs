// `npm run par`: prints the Par balance report. Loads the TypeScript through Vite, so no extra tools are needed.
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { parReport } = await server.ssrLoadModule('/tools/par-report.ts');
  console.log(parReport());
} finally {
  await server.close();
}

import { Snowfall } from './Snowfall';

export function App() {
  return (
    <main className="title-screen">
      <Snowfall />
      <div className="title-card">
        <h1>Snowbound Signal</h1>
        <p>The town is snowed in. The festival is tomorrow. You're the only one who can fix the TVs.</p>
        <button type="button" disabled>
          New Game (coming soon)
        </button>
      </div>
    </main>
  );
}

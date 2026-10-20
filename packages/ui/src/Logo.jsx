const SLABS = ['M82.5 142L0 457H166Z', 'M117 0L93.5 85L190 457H361L244 0Z', 'M308 0L283 87L381 457H552L435 0Z'];

export function Logo({ tone = 'currentColor' }) {
  return (
    <svg viewBox="0 0 552 457" aria-hidden="true">
      {SLABS.map((d) => <path key={d} d={d} fill={tone} />)}
    </svg>
  );
}

/** "movers learn" / "movers space" / "movers admin" wordmark. */
export function Brand({ word, tone, href = '/', as: As = 'a' }) {
  return (
    <As className="brand" href={As === 'a' ? href : undefined} to={As !== 'a' ? href : undefined}>
      <Logo tone={tone} />
      <span>movers <b>{word}</b></span>
    </As>
  );
}

'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="join-shell">
      <section className="join-card" role="alert">
        <h1>잠시 연결이 원활하지 않습니다</h1>
        <p>계정 또는 대국 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        <button className="match-button" onClick={reset}>다시 시도</button>
      </section>
    </main>
  );
}

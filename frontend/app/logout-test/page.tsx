'use client';

import { useState } from 'react';

export default function LogoutTestPage() {
  const [result, setResult] = useState('');

  async function checkSession() {
    try {
      const response = await fetch('http://localhost:3000/auth/me', {
        credentials: 'include',
      });

      const data = await response.json();
      setResult(
        response.ok
          ? `Signed in as: ${data.displayName}`
          : `Not signed in (HTTP ${response.status})`,
      );
    } catch {
      setResult('Could not connect to the backend.');
    }
  }

  async function logout() {
    try {
      const response = await fetch('http://localhost:3000/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();
      setResult(
        response.ok
          ? data.message
          : `Logout failed (HTTP ${response.status})`,
      );
    } catch {
      setResult('Could not connect to the backend.');
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1>NowRJ Session Test</h1>

      <button onClick={checkSession} style={{ marginRight: 12, padding: 10 }}>
        Check session
      </button>

      <button onClick={logout} style={{ padding: 10 }}>
        Log out
      </button>

      <p style={{ marginTop: 24 }}>{result}</p>
    </main>
  );
}
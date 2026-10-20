"use client";

import { useEffect, useState } from "react";

const API = "http://localhost:3000";

type RjProfile = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  photoUrl: string | null;
  isActive: boolean;
  verificationStatus: string;
};

export default function RjRegisterPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<RjProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const authResponse = await fetch(`${API}/auth/me`, {
          credentials: "include",
        });

        if (authResponse.status === 401) {
          window.location.href = `${API}/auth/google?returnTo=%2Frj%2Fregister`;
          return;
        }

        if (!authResponse.ok) {
          setError("Could not verify your sign-in. Please try again.");
          return;
        }

        const profileResponse = await fetch(`${API}/rjs/me`, {
          credentials: "include",
        });

        if (!profileResponse.ok) {
          setError("Could not check your RJ profile. Please refresh.");
          return;
        }

        const responseText = await profileResponse.text();

        if (responseText.trim() && responseText.trim() !== "null") {
          const data = JSON.parse(responseText) as RjProfile;
          setProfile(data);
        }
      } catch {
        setError("Could not connect to NowRJ. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!name.trim()) {
      setError("Please enter your RJ name.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API}/rjs/register`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          photoUrl: photoUrl.trim() || null,
        }),
      });

      if (response.status === 401) {
        window.location.href = `${API}/auth/google?returnTo=%2Frj%2Fregister`;
        return;
      }

      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : null;

      if (!response.ok) {
        setError(
          data?.message || "Registration failed. Please try again.",
        );
        return;
      }

      setProfile(data as RjProfile);
      setMessage("Your RJ profile has been submitted for verification.");
    } catch {
      setError("Could not connect to NowRJ. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12">
        <p className="text-gray-600">Checking your account...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <a href="/" className="text-sm font-medium text-orange-700">
        â† Back to NowRJ
      </a>

      <header className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">
          For radio jockeys
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
          Your RJ profile
        </h1>
        <p className="mt-3 text-gray-600">
          Create your profile on NowRJ and build a direct connection with
          your listeners.
        </p>
      </header>

      {error && (
        <p
          className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          role="status"
        >
          {message}
        </p>
      )}

      {profile ? (
        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            {profile.name}
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Profile URL: /rj/{profile.slug}
          </p>

          <div className="mt-5">
            <p className="text-sm text-gray-500">Verification status</p>
            <p className="mt-1 font-semibold capitalize text-gray-900">
              {profile.verificationStatus}
            </p>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            {profile.verificationStatus === "verified"
              ? "Your RJ profile is verified."
              : profile.verificationStatus === "rejected"
                ? "Your profile was not approved. Please contact the NowRJ team."
                : "Your profile is awaiting verification. It will not appear in the public RJ directory until approved."}
          </p>

          <p className="mt-3 text-sm text-gray-500">
            Profile active: {profile.isActive ? "Yes" : "No"}
          </p>
        </section>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label
              htmlFor="rj-name"
              className="mb-2 block text-sm font-medium text-gray-800"
            >
              RJ name *
            </label>
            <input
              id="rj-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
              placeholder="The name listeners know you by"
              className="min-h-12 w-full rounded-lg border border-gray-300 px-4 text-gray-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label
              htmlFor="rj-phone"
              className="mb-2 block text-sm font-medium text-gray-800"
            >
              Phone number
            </label>
            <input
              id="rj-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={20}
              placeholder="Your contact number"
              className="min-h-12 w-full rounded-lg border border-gray-300 px-4 text-gray-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label
              htmlFor="rj-photo"
              className="mb-2 block text-sm font-medium text-gray-800"
            >
              Profile photo URL (optional)
            </label>
            <input
              id="rj-photo"
              type="url"
              value={photoUrl}
              onChange={(event) => setPhotoUrl(event.target.value)}
              maxLength={255}
              placeholder="https://example.com/your-photo.jpg"
              className="min-h-12 w-full rounded-lg border border-gray-300 px-4 text-gray-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          
            <p className="text-sm leading-6 text-gray-600">
              Your profile will remain inactive until the NowRJ team verifies
              it. You can register only one RJ profile per listener account.
            </p>

            <button
              type="submit"
              disabled={submitting}
              className="min-h-12 w-full rounded-full bg-orange-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit RJ profile"}
            </button>
          </form>
        )}
      </main>
    );
  }


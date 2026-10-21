import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalPage } from "../lib/legal";

export const metadata: Metadata = { title: "Privacy Policy · NowRJ" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        NowRJ (nowrj.com) connects radio listeners with RJs and their programmes. It is run by <strong>Now On FM</strong>,
        a partnership firm in India (&ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains what personal data we collect,
        why, and the choices you have. We follow India&rsquo;s Digital Personal Data Protection Act, 2023.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>When you sign in with Google:</strong> your name, email address, profile photo and Google account ID. We never see your Google password.</li>
        <li><strong>What you do on NowRJ:</strong> RJs you follow, Likes and Fires you give, song requests (song, artist and any message you write), and taps on a programme&rsquo;s call button.</li>
        <li><strong>If you are an RJ:</strong> your RJ name, photo, phone and email, the programmes and schedules you publish, your station, referrals and vouches.</li>
        <li><strong>If you represent a station:</strong> the station&rsquo;s details and contact phone and email, and the actions you take for the station.</li>
        <li><strong>Technical data:</strong> a sign-in cookie that keeps you signed in, and, if you tap a call button while signed out, a random ID stored in your browser so we count each person once. We do not use advertising or tracking cookies.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To run your account and show you the right pages and dashboards.</li>
        <li>To show RJs and stations how their programmes are doing: follower, reaction, call-tap and song-request numbers. Song requests, including your name and message, are shown to the RJ and station of that show.</li>
        <li>To verify RJs and stations and to prevent fake accounts and abuse.</li>
        <li>To run the referral programme and, once Now On FM launches, to calculate any revenue share.</li>
        <li>To keep the service secure and to meet legal obligations.</li>
      </ul>
      <p>We do not sell your personal data, and we do not use it for third-party advertising.</p>

      <h2>Who can see it</h2>
      <ul>
        <li><strong>Public:</strong> verified RJ profiles, programmes, schedules and total reaction counts.</li>
        <li><strong>RJs and stations:</strong> engagement numbers for their own programmes and song requests made to their shows.</li>
        <li><strong>Service providers:</strong> Amazon Web Services hosts NowRJ in Mumbai, India, and Google provides sign-in. They process data only for us.</li>
        <li><strong>Authorities:</strong> only when the law requires it.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        We keep your data while your account is open. When you delete your account, your personal data is erased straight
        away (see below). Copies in our encrypted backups are overwritten within 30 days.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li><strong>Access and correction:</strong> ask us for a summary of your data or to correct it.</li>
        <li><strong>Deletion:</strong> delete your account at any time from <a href="/account">Account settings</a>. Your name, email, photo, follows, reactions, song requests and roles are erased. Totals stay, but no longer identify you. If you are an RJ, your profile becomes &ldquo;Former RJ&rdquo; and is hidden; programmes owned by a station stay with that station.</li>
        <li><strong>Withdraw consent:</strong> deleting your account withdraws your consent to processing.</li>
        <li><strong>Nominate:</strong> name someone to exercise these rights if you die or become unable to.</li>
        <li><strong>Complain:</strong> contact our Grievance Officer below. If you are not satisfied, you can approach the Data Protection Board of India.</li>
      </ul>

      <h2>Age</h2>
      <p>NowRJ is only for people aged 18 and over. If we learn that someone under 18 has an account, we will delete it.</p>

      <h2>Security</h2>
      <p>Data is sent over HTTPS, stored on servers in India, and access is limited to the people who run NowRJ.</p>

      <h2>Changes</h2>
      <p>If we change this policy we will update the date above, and tell you on the site when the change is significant.</p>

      <h2>Contact and Grievance Officer</h2>
      <p>
        Grievance Officer, Now On FM — <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We reply within 30 days.
      </p>
    </LegalPage>
  );
}

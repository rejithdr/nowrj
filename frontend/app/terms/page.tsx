import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalPage } from "../lib/legal";

export const metadata: Metadata = { title: "Terms of Use · NowRJ" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p>
        These terms are an agreement between you and <strong>Now On FM</strong>, a partnership firm in India that runs
        NowRJ (nowrj.com). By using NowRJ you agree to them and to our <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Who can use NowRJ</h2>
      <p>You must be 18 or older and sign in with your own Google account. Keep your account secure; you are responsible for what happens under it.</p>

      <h2>Listeners</h2>
      <ul>
        <li>Follow RJs, react to shows, request songs and call programmes.</li>
        <li>Song requests and messages go to the RJ and station of that show. RJs and stations decide whether to play a request.</li>
        <li>Call buttons dial the number the RJ or station has set. Calls are charged by your phone operator, not by NowRJ.</li>
      </ul>

      <h2>RJs and stations</h2>
      <ul>
        <li>Give accurate information about yourself, your station and your programmes. We may verify it and may reject or remove profiles that are inaccurate or misleading.</li>
        <li>An RJ may create programmes. When a station joins NowRJ it can claim the programmes aired on it; ownership then moves to the station as described on the dashboards.</li>
        <li>Only publish content you have the right to share. You keep ownership of it and give us permission to display it on NowRJ and Now On FM.</li>
        <li>Referral rewards and revenue shares will start only when Now On FM launches its advertising service, on terms we will publish then. Nothing is earned or payable before that.</li>
      </ul>

      <h2>Not allowed</h2>
      <ul>
        <li>Harassing, threatening, hateful, obscene or illegal content, including in song request messages.</li>
        <li>Pretending to be another RJ, station or person, or creating fake accounts, referrals or vouches.</li>
        <li>Spamming, scraping, or trying to break or overload the service.</li>
      </ul>
      <p>We may remove content, or suspend or close accounts, that break these terms.</p>

      <h2>Closing your account</h2>
      <p>You can delete your account at any time from <a href="/account">Account settings</a>. What happens to your data is explained in the Privacy Policy.</p>

      <h2>The service</h2>
      <p>
        NowRJ is provided &ldquo;as is&rdquo;. Schedules and call-in numbers come from RJs and stations, and we cannot guarantee
        they are always correct or that the service is always available. To the extent the law allows, we are not liable for
        indirect losses arising from your use of NowRJ.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms. We will change the date above and tell you on the site when a change is significant. Continuing to use NowRJ means you accept the updated terms.</p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of India.</p>

      <h2>Contact</h2>
      <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
    </LegalPage>
  );
}
